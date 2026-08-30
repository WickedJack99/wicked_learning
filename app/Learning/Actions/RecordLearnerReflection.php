<?php

namespace App\Learning\Actions;

use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Learning\Services\ActivityFeedbackGuidanceConfiguration;
use App\Learning\Services\JournalMarkdownComposer;
use App\Learning\Services\LearnerActivityAccessService;
use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Records a reflection only while the learner is at its authenticated activity. */
class RecordLearnerReflection
{
    public function __construct(
        private readonly LearnerActivityAccessService $activityAccess,
        private readonly ActivityCompetenceConfiguration $activityCompetence,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidance,
        private readonly JournalMarkdownComposer $markdown,
    ) {}

    /**
     * @param  array{reflection: string, response_context?: string|null, observed_cues?: list<string>, topic?: string|null, subtopic?: string|null}  $data
     */
    public function forActivity(User $user, LearningActivity $activity, string $playRunId, array $data): LearnerReflection
    {
        $this->ensureActive($user, $activity, $playRunId);
        $config = is_array($activity->config) ? $activity->config : [];

        return $this->record(
            user: $user,
            activity: $activity,
            dialogueNode: null,
            playRunId: $playRunId,
            data: [
                ...$data,
                'topic' => trim((string) ($data['topic'] ?? '')) ?: ($config['topic'] ?? null),
                'subtopic' => trim((string) ($data['subtopic'] ?? '')) ?: ($config['subtopic'] ?? null),
            ],
            question: (string) ($config['prompt'] ?? 'What feels clearer now?'),
            responseType: $this->responseTypeForActivity($activity),
            title: $activity->node->title.' - '.$activity->title,
        );
    }

    /**
     * @param  array{reflection: string, topic?: string|null, subtopic?: string|null}  $data
     */
    public function forDialogueNode(User $user, NpcDialogueNode $dialogueNode, string $playRunId, array $data): LearnerReflection
    {
        $dialogueNode->loadMissing('activity.node');
        $activity = $dialogueNode->activity;
        abort_unless($activity !== null, 404);
        $this->ensureActive($user, $activity, $playRunId);

        return $this->record(
            user: $user,
            activity: $activity,
            dialogueNode: $dialogueNode,
            playRunId: $playRunId,
            data: $data,
            question: $dialogueNode->body ?: $dialogueNode->title,
            responseType: 'reflection',
            title: $activity->node->title.' - '.$dialogueNode->title,
        );
    }

    private function ensureActive(User $user, LearningActivity $activity, string $playRunId): void
    {
        $this->activityAccess->assertActive($user, $activity, $playRunId);
    }

    /**
     * @param  array{reflection: string, response_context?: string|null, observed_cues?: list<string>, topic?: string|null, subtopic?: string|null}  $data
     */
    private function record(
        User $user,
        LearningActivity $activity,
        ?NpcDialogueNode $dialogueNode,
        string $playRunId,
        array $data,
        string $question,
        string $responseType,
        string $title,
    ): LearnerReflection {
        if ($responseType === 'transfer' && trim((string) ($data['response_context'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'response_context' => 'Name the changed context where you tried the idea.',
            ]);
        }

        $observedCues = in_array($responseType, ['explain', 'transfer'], true)
            ? $this->feedbackGuidance->observedCuesForActivity(
                $activity,
                $data['observed_cues'] ?? null,
            )
            : [];

        return DB::transaction(function () use ($user, $activity, $dialogueNode, $data, $observedCues, $playRunId, $question, $responseType, $title): LearnerReflection {
            $topic = trim((string) ($data['topic'] ?? $activity->node->title)) ?: $activity->node->title;
            $subtopic = trim((string) ($data['subtopic'] ?? $activity->title));
            $page = LearnerJournalPage::query()->firstOrCreate([
                'user_id' => $user->id,
                'topic' => $topic,
                'subtopic' => $subtopic,
            ], [
                'title' => $this->pageTitle($topic, $subtopic),
                'markdown' => '',
                'preferred_mode' => 'view',
                'expert_access_requested' => false,
            ]);

            $reflection = LearnerReflection::query()->create([
                'user_id' => $user->id,
                'learner_journal_page_id' => $page->id,
                'learning_node_id' => $activity->learning_node_id,
                'learning_activity_id' => $activity->id,
                'play_run_id' => $playRunId,
                'npc_dialogue_node_id' => $dialogueNode?->id,
                'title' => $title,
                'question' => $question,
                'reflection' => (string) $data['reflection'],
                'response_type' => $responseType,
                'response_context' => $responseType === 'transfer'
                    ? trim((string) ($data['response_context'] ?? ''))
                    : null,
                'observed_cues' => $observedCues === [] ? null : $observedCues,
                'expert_access_requested' => false,
                'feedback_status' => 'not_requested',
            ]);

            $page->forceFill([
                'markdown' => $this->markdown->append($page->markdown, $reflection),
            ])->save();

            return $reflection->load('page');
        });
    }

    private function pageTitle(string $topic, string $subtopic): string
    {
        $title = $subtopic === '' ? $topic : "{$topic} - {$subtopic}";

        return mb_strimwidth($title, 0, 240);
    }

    private function responseTypeForActivity(LearningActivity $activity): string
    {
        if (! in_array($activity->type, ['reflection', 'review'], true)) {
            return 'reflection';
        }

        $intent = $this->activityCompetence->learningIntentForActivity($activity);

        return in_array($intent, ['explain', 'transfer'], true) ? $intent : 'reflection';
    }
}
