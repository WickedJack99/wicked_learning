<?php

namespace App\Learning\Services;

use App\Ai\Actions\RunAiAgentTemplate;
use App\Learning\CurrentWorldResolver;
use App\Models\AiAgentTemplate;
use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformCompanionSetting;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Runs one authored companion AI node with a server-bounded context. */
class LearningCompanionTurnService
{
    private const MAX_OUTPUT_TOKENS = 400;

    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningCompanionConfigurationResolver $configurationResolver,
        private readonly LearnerActivityAccessService $activityAccess,
        private readonly LearningMapAccessService $mapAccess,
        private readonly RunAiAgentTemplate $runTemplate,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidance,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{node_id: string, text: string, assistance_level: string, disclosure: array{kind: string, uses_private_learner_response: bool, can_navigate: bool, can_change_content: bool}|null}
     */
    public function handle(User $user, array $data): array
    {
        [$world, $map, $node, $activity] = $this->resolveContext($user, $data);
        $configuration = $this->configurationResolver->resolve(
            PlatformCompanionSetting::current(),
            $world,
            $map,
            $node,
            $activity,
        );

        if (! $configuration['enabled']
            || ! $configuration['ai']['enabled']
            || ! in_array($configuration['mode'], ['guided_ai', 'open_ai'], true)
        ) {
            throw ValidationException::withMessages([
                'turn' => 'AI assistance is not enabled for this companion context.',
            ]);
        }

        $nodeId = (string) $data['dialogue_node_id'];
        $dialogueNode = collect($configuration['dialogue']['nodes'] ?? [])
            ->first(fn (mixed $candidate): bool => is_array($candidate)
                && ($candidate['id'] ?? null) === $nodeId);

        if (! is_array($dialogueNode) || ($dialogueNode['type'] ?? null) !== 'ai') {
            throw ValidationException::withMessages([
                'dialogue_node_id' => 'Choose an authored AI dialogue node.',
            ]);
        }

        $assistanceLevel = (string) $data['assistance_level'];

        if ($assistanceLevel === 'post-attempt' && ! $this->hasCompletedActivity($user, $activity)) {
            throw ValidationException::withMessages([
                'assistance_level' => 'Post-attempt support is available after completing this activity.',
            ]);
        }

        if ($assistanceLevel === 'off') {
            return [
                'node_id' => $nodeId,
                'text' => '',
                'assistance_level' => 'untracked',
                'disclosure' => null,
            ];
        }

        $templateId = $configuration['ai']['templateId'];
        $template = is_int($templateId)
            ? AiAgentTemplate::query()
                ->whereKey($templateId)
                ->where('purpose', 'learner_companion')
                ->where('enabled', true)
                ->where('guarded_context', true)
                ->first()
            : null;

        if (! $template) {
            throw ValidationException::withMessages([
                'turn' => 'The selected learner companion AI template is not available.',
            ]);
        }

        $template->setAttribute(
            'max_output_tokens',
            min($template->max_output_tokens ?? self::MAX_OUTPUT_TOKENS, self::MAX_OUTPUT_TOKENS),
        );

        $capabilities = array_values(array_intersect(
            is_array($dialogueNode['capabilities'] ?? null) ? $dialogueNode['capabilities'] : [],
            is_array($configuration['ai']['capabilities'] ?? null) ? $configuration['ai']['capabilities'] : [],
        ));

        $result = $this->runTemplate->handle(
            $template,
            $this->prompt(
                $dialogueNode,
                $data,
                $capabilities,
                $world,
                $map,
                $node,
                $activity,
                $assistanceLevel,
            ),
        );

        return [
            'node_id' => $nodeId,
            'text' => mb_substr(trim($result['text']), 0, 1200),
            'assistance_level' => $this->evidenceAssistanceLevel($assistanceLevel),
            'disclosure' => [
                'kind' => 'bounded_authored_context',
                'uses_private_learner_response' => false,
                'can_navigate' => false,
                'can_change_content' => false,
            ],
        ];
    }

    private function evidenceAssistanceLevel(string $assistanceLevel): string
    {
        return match ($assistanceLevel) {
            'question' => 'questions_only',
            'hint' => 'hint',
            'post-attempt' => 'post_attempt_support',
            default => 'untracked',
        };
    }

    private function hasCompletedActivity(User $user, ?LearningActivity $activity): bool
    {
        return $activity !== null
            && LearnerActivityProgress::query()
                ->where('user_id', $user->id)
                ->where('learning_activity_id', $activity->id)
                ->where('status', 'completed')
                ->exists();
    }

    /** @return array{0: LearningWorld|null, 1: LearningMap|null, 2: LearningNode|null, 3: LearningActivity|null} */
    private function resolveContext(User $user, array $data): array
    {
        $surface = (string) $data['surface'];

        if ($surface === 'desk') {
            return [null, null, null, null];
        }

        $world = $this->worldResolver->resolveOrFail();

        if ($surface === 'world') {
            $map = LearningMap::query()
                ->where('learning_world_id', $world->id)
                ->when($data['map_id'] ?? null, fn ($query, mixed $mapId) => $query->whereKey((int) $mapId))
                ->with('topic')
                ->first();

            abort_unless($map && $this->mapAccess->canViewMap($map, $user), 404);

            return [$world, $map, null, null];
        }

        $node = LearningNode::query()
            ->with('map.world', 'map.topic')
            ->whereKey((int) $data['node_id'])
            ->firstOrFail();
        $this->activityAccess->assertCanViewNode($user, $node);
        abort_unless($node->map?->learning_world_id === $world->id, 404);

        $activity = null;
        if (isset($data['activity_id'])) {
            $activity = LearningActivity::query()
                ->where('learning_node_id', $node->id)
                ->whereKey((int) $data['activity_id'])
                ->firstOrFail();
            $this->activityAccess->assertCanPlay($user, $activity);
        }

        return [$world, $node->map, $node, $activity];
    }

    /** @param array<string, mixed> $dialogueNode @param array<string, mixed> $data @param list<string> $capabilities */
    private function prompt(
        array $dialogueNode,
        array $data,
        array $capabilities,
        ?LearningWorld $world,
        ?LearningMap $map,
        ?LearningNode $node,
        ?LearningActivity $activity,
        string $assistanceLevel,
    ): string {
        $assistanceInstruction = match ($assistanceLevel) {
            'question' => 'Ask one brief reflective question. Do not answer the question or complete the task for the learner.',
            'hint' => 'Give one small, actionable hint. Do not provide a complete solution or pretend the learner has mastered anything.',
            'post-attempt' => 'Offer one brief comparison or next question after the learner has attempted the activity. Use only the authored guidance below. Do not infer whether the learner was correct, request or repeat their private response, or claim mastery.',
            default => 'Do not provide AI assistance.',
        };
        $lines = [
            'Return one concise plain-text message for the learner companion.',
            'Follow the authored instruction within the supplied context only.',
            'Do not claim private learner information, change content, or issue navigation commands.',
            'If the context is insufficient, say that plainly and invite the learner to choose their own next step.',
            $assistanceInstruction,
            '',
            'Authored instruction: '.mb_substr((string) ($dialogueNode['instruction'] ?? ''), 0, 1000),
            'Allowed context: '.implode(', ', $dialogueNode['capabilities'] ?? []),
            'Surface: '.(string) $data['surface'],
        ];

        if ($assistanceLevel === 'post-attempt' && $activity !== null) {
            $guidance = $this->feedbackGuidance->forActivity($activity) ?? [];
            $lines[] = '';
            $lines[] = 'Authored post-attempt guidance (the only response-specific material available):';

            foreach ([
                'Purpose' => $guidance['purpose'] ?? null,
                'What to notice' => $guidance['evidence'] ?? null,
                'Compare your response' => $guidance['responseFeedback'] ?? null,
                'Possible next action' => $guidance['nextAction'] ?? null,
            ] as $label => $value) {
                if (is_string($value) && trim($value) !== '') {
                    $lines[] = $label.': '.mb_substr(trim($value), 0, 500);
                }
            }
        }

        $references = in_array('current-context', $capabilities, true)
            ? [
                'World' => $world?->title,
                'Map' => $map?->title,
                'Place' => $node?->title,
                'Activity' => $activity?->title,
            ]
            : [];

        if (in_array('topic-context', $capabilities, true)) {
            $references['Topic'] = $map?->topic?->title;
        }

        foreach ($references as $label => $value) {
            if (is_string($value) && trim($value) !== '') {
                $lines[] = $label.': '.mb_substr(trim($value), 0, 160);
            }
        }

        return implode("\n", $lines);
    }
}
