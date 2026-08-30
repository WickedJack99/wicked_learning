<?php

namespace App\Learning\Serializers;

use App\Learning\Services\ActivityCompletionChoiceConfiguration;
use App\Learning\Services\ActivityFeedbackGuidanceConfiguration;
use App\Learning\Services\ActivitySourceReferenceConfiguration;
use App\Models\ActivityTransition;
use App\Models\LearnerReflection;
use App\Models\LearningActivity;
use App\Models\LearningDialogueSoundSet;
use App\Models\LearningItem;
use App\Models\LearningQuestionOption;
use App\Models\LearningSound;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use Illuminate\Support\Collection;

class LearningActivitySerializer
{
    public function __construct(
        private readonly LearningToolSerializer $toolSerializer,
        private readonly LearningItemSerializer $itemSerializer,
        private readonly SharedTaskStateSerializer $sharedTaskState,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidance,
        private readonly ActivitySourceReferenceConfiguration $sourceReferences,
        private readonly ActivityCompletionChoiceConfiguration $completionChoice,
        private readonly DialogueTypingSoundSetSerializer $dialogueSoundSetSerializer,
    ) {}

    /**
     * @param  Collection<int, LearnerReflection>|null  $reviewReflections
     * @return array<string, mixed>
     */
    public function serialize(
        LearningActivity $activity,
        ?Collection $reviewReflections = null,
        ?Collection $dialogueSoundSets = null,
    ): array {
        return [
            'id' => $activity->id,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $this->learnerConfig($activity),
            'feedbackGuidance' => $this->feedbackGuidance->forActivity($activity),
            'sources' => $this->sourceReferences->forActivity($activity),
            'completionChoicePrompt' => $this->completionChoice->forActivity($activity),
            'configuredItems' => $this->configuredItems($activity),
            'configuredSounds' => $this->configuredSounds($activity),
            'dialogueTypingSoundSets' => $activity->type === 'npc_dialogue'
                ? $this->configuredDialogueSoundSets($activity, $dialogueSoundSets)
                : [],
            'configuredTool' => $this->configuredTool($activity),
            'npcDialogueNodes' => $activity->npcDialogueNodes
                ->map(fn (NpcDialogueNode $node): array => $this->npcDialogueNode($node))
                ->values(),
            'npcDialogueTransitions' => $activity->npcDialogueTransitions
                ->map(fn (NpcDialogueTransition $transition): array => $this->npcDialogueTransition($transition))
                ->values(),
            'question' => $this->question($activity),
            'reviewContext' => $this->reviewContext($activity, $reviewReflections),
            'sharedTaskState' => $activity->type === 'shared_task'
                ? $this->sharedTaskState->state($activity)
                : null,
            'transitions' => $activity->transitions
                ->map(fn (ActivityTransition $transition): array => $this->transition($transition))
                ->values(),
        ];
    }

    /** @return array<string, mixed> */
    private function learnerConfig(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        unset($config[ActivitySourceReferenceConfiguration::CONFIG_KEY]);
        $topics = $config['competenceTopics'] ?? null;

        if (! is_array($topics)) {
            return $config;
        }

        $config['competenceTopics'] = array_values(array_filter(array_map(
            static fn (mixed $topic): ?array => is_array($topic) && is_string($topic['topic'] ?? null)
                ? [
                    'slug' => is_string($topic['slug'] ?? null) ? $topic['slug'] : null,
                    'topic' => $topic['topic'],
                ]
                : null,
            $topics,
        )));

        return $config;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function configuredSounds(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $itemObstacleSounds = is_array($config['sounds'] ?? null) ? $config['sounds'] : [];
        $ambientSound = is_array($config['ambientSound'] ?? null) ? $config['ambientSound'] : [];
        $ids = collect($itemObstacleSounds)
            ->filter(fn (mixed $sound): bool => is_array($sound))
            ->map(fn (mixed $sound): int => (int) ($sound['soundId'] ?? 0))
            ->push((int) ($ambientSound['soundId'] ?? 0))
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return LearningSound::query()
            ->whereIn('id', $ids->all())
            ->get()
            ->map(fn (LearningSound $sound): array => [
                'id' => $sound->id,
                'name' => $sound->name,
                'slug' => $sound->slug,
                'icon' => $sound->icon,
                'url' => $sound->url,
                'volume' => $sound->volume,
                'playSeconds' => $sound->play_seconds,
                'loop' => $sound->loop,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, LearningDialogueSoundSet>|null  $dialogueSoundSets
     * @return array<int, array<string, mixed>>
     */
    private function configuredDialogueSoundSets(LearningActivity $activity, ?Collection $dialogueSoundSets): array
    {
        $nodes = $activity->npcDialogueNodes;
        $enabledNodes = $nodes->filter(function (NpcDialogueNode $node): bool {
            $config = is_array($node->config) ? $node->config : [];

            return (bool) ($config['typingSoundEnabled'] ?? false);
        });

        if ($enabledNodes->isEmpty()) {
            return [];
        }

        $ids = $enabledNodes
            ->map(function (NpcDialogueNode $node): int {
                $config = is_array($node->config) ? $node->config : [];
                $value = $config['typingSoundSetId'] ?? null;

                return is_numeric($value) ? (int) $value : 0;
            })
            ->filter()
            ->unique()
            ->values();
        $usesDefault = $enabledNodes->contains(function (NpcDialogueNode $node): bool {
            $config = is_array($node->config) ? $node->config : [];

            return ! is_numeric($config['typingSoundSetId'] ?? null);
        });

        $sets = $dialogueSoundSets ?? LearningDialogueSoundSet::query()
            ->with('sounds')
            ->where(function ($query) use ($ids, $usesDefault): void {
                if ($ids->isNotEmpty()) {
                    $query->whereIn('id', $ids->all());
                }

                if ($usesDefault) {
                    $query->orWhere('is_default', true);
                }
            })
            ->get();

        return $sets
            ->map(fn (LearningDialogueSoundSet $set): array => $this->dialogueSoundSetSerializer->learner($set))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function configuredItems(LearningActivity $activity): array
    {
        if (! in_array($activity->type, ['item_grant', 'item_obstacle'], true)) {
            return [];
        }

        $ids = collect($this->configuredItemIds($activity))->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return LearningItem::query()
            ->whereIn('id', $ids->all())
            ->get()
            ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function configuredItemIds(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        if ($activity->type === 'item_grant') {
            $items = is_array($config['items'] ?? null) ? $config['items'] : [];

            return array_values(array_filter(array_map(
                fn (mixed $item): int => is_array($item) ? (int) ($item['itemId'] ?? 0) : 0,
                $items,
            )));
        }

        $slots = is_array($config['slots'] ?? null) ? $config['slots'] : [];

        return array_values(array_filter(array_map(
            fn (mixed $slot): int => is_array($slot) ? (int) ($slot['itemId'] ?? 0) : 0,
            $slots,
        )));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function configuredTool(LearningActivity $activity): ?array
    {
        if ($activity->type !== 'tool_grant') {
            return null;
        }

        $config = is_array($activity->config) ? $activity->config : [];
        $toolId = is_numeric($config['toolId'] ?? null) ? (int) $config['toolId'] : 0;

        if ($toolId <= 0) {
            return null;
        }

        $tool = LearningTool::query()->find($toolId);

        return $tool instanceof LearningTool
            ? $this->toolSerializer->serialize($tool)
            : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function npcDialogueNode(NpcDialogueNode $node): array
    {
        return [
            'id' => $node->id,
            'type' => $node->type,
            'title' => $node->title,
            'body' => $node->body,
            'config' => $node->config ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function npcDialogueTransition(NpcDialogueTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'fromNodeId' => $transition->from_dialogue_node_id,
            'toNodeId' => $transition->to_dialogue_node_id,
            'fromConnector' => $transition->from_connector,
            'toConnector' => $transition->to_connector,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function question(LearningActivity $activity): ?array
    {
        if (! $activity->question) {
            return null;
        }

        return [
            'id' => $activity->question->id,
            'prompt' => $activity->question->prompt,
            'allowMultiple' => $activity->question->allow_multiple,
            'options' => $activity->question->options
                ->map(fn (LearningQuestionOption $option): array => $this->questionOption($option))
                ->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function questionOption(LearningQuestionOption $option): array
    {
        return [
            'id' => $option->id,
            'label' => $option->label,
            'body' => $option->body,
            'outcomeKey' => $option->outcome_key,
            'weights' => $option->weights ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transition(ActivityTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'toActivityId' => $transition->to_activity_id,
            'fromConnector' => $transition->from_connector ?? $transition->trigger ?? 'completed',
            'toConnector' => $transition->to_connector ?? 'in',
            'trigger' => $transition->trigger,
            'triggerValue' => $transition->trigger_value,
            'label' => $transition->label,
        ];
    }

    /**
     * @param  Collection<int, LearnerReflection>|null  $reviewReflections
     * @return list<array{id: int, question: string, reflection: string, createdAt: string|null}>|null
     */
    private function reviewContext(LearningActivity $activity, ?Collection $reviewReflections): ?array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        if (! in_array($activity->type, ['reflection', 'review'], true)
            || ($activity->type !== 'review' && ($config['learningIntent'] ?? null) !== 'review')) {
            return null;
        }

        return array_values(($reviewReflections ?? collect())
            ->take(3)
            ->map(fn (LearnerReflection $reflection): array => [
                'id' => $reflection->id,
                'question' => $reflection->question,
                'reflection' => $reflection->reflection,
                'createdAt' => $reflection->created_at?->toIso8601String(),
            ])
            ->values()
            ->all());
    }
}
