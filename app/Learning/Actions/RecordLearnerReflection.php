<?php

namespace App\Learning\Actions;

use App\Learning\Services\ActiveLearningActivityResolver;
use App\Learning\Services\JournalMarkdownComposer;
use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;
use App\Models\PlatformJournalSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/** Records a reflection only while the learner is at its authenticated activity. */
class RecordLearnerReflection
{
    public function __construct(
        private readonly ActiveLearningActivityResolver $activeActivity,
        private readonly JournalMarkdownComposer $markdown,
    ) {}

    /**
     * @param  array{reflection: string, topic?: string|null, subtopic?: string|null, request_expert_access?: bool}  $data
     */
    public function forActivity(User $user, LearningActivity $activity, string $playRunId, array $data): LearnerReflection
    {
        $this->ensureActive($user, $activity, $playRunId);
        $config = is_array($activity->config) ? $activity->config : [];

        return $this->record(
            user: $user,
            activity: $activity,
            dialogueNode: null,
            data: [
                ...$data,
                'topic' => trim((string) ($data['topic'] ?? '')) ?: ($config['topic'] ?? null),
                'subtopic' => trim((string) ($data['subtopic'] ?? '')) ?: ($config['subtopic'] ?? null),
            ],
            question: (string) ($config['prompt'] ?? 'What feels clearer now?'),
            title: $activity->node->title.' - '.$activity->title,
        );
    }

    /**
     * @param  array{reflection: string, topic?: string|null, subtopic?: string|null, request_expert_access?: bool}  $data
     */
    public function forDialogueNode(User $user, NpcDialogueNode $dialogueNode, string $playRunId, array $data): LearnerReflection
    {
        $dialogueNode->loadMissing('activity.node');
        $activity = $dialogueNode->activity;
        $this->ensureActive($user, $activity, $playRunId);

        return $this->record(
            user: $user,
            activity: $activity,
            dialogueNode: $dialogueNode,
            data: $data,
            question: $dialogueNode->body ?: $dialogueNode->title,
            title: $activity->node->title.' - '.$dialogueNode->title,
        );
    }

    private function ensureActive(User $user, LearningActivity $activity, string $playRunId): void
    {
        if (! $this->activeActivity->isActive($user, $activity, $playRunId)) {
            throw (new ModelNotFoundException)->setModel(LearningActivity::class);
        }
    }

    /**
     * @param  array{reflection: string, topic?: string|null, subtopic?: string|null, request_expert_access?: bool}  $data
     */
    private function record(
        User $user,
        LearningActivity $activity,
        ?NpcDialogueNode $dialogueNode,
        array $data,
        string $question,
        string $title,
    ): LearnerReflection {
        return DB::transaction(function () use ($user, $activity, $dialogueNode, $data, $question, $title): LearnerReflection {
            $topic = trim((string) ($data['topic'] ?? $activity->node->title)) ?: $activity->node->title;
            $subtopic = trim((string) ($data['subtopic'] ?? $activity->title));
            $expertAccess = (bool) ($data['request_expert_access'] ?? false)
                && PlatformJournalSetting::current()->allow_expert_access_requests;

            $page = LearnerJournalPage::query()->firstOrCreate([
                'user_id' => $user->id,
                'topic' => $topic,
                'subtopic' => $subtopic,
            ], [
                'title' => $this->pageTitle($topic, $subtopic),
                'markdown' => '',
                'preferred_mode' => 'view',
                'expert_access_requested' => $expertAccess,
            ]);

            if ($expertAccess && ! $page->expert_access_requested) {
                $page->forceFill(['expert_access_requested' => true])->save();
            }

            $reflection = LearnerReflection::query()->create([
                'user_id' => $user->id,
                'learner_journal_page_id' => $page->id,
                'learning_node_id' => $activity->learning_node_id,
                'learning_activity_id' => $activity->id,
                'npc_dialogue_node_id' => $dialogueNode?->id,
                'title' => $title,
                'question' => $question,
                'reflection' => (string) $data['reflection'],
                'expert_access_requested' => $expertAccess,
                'feedback_status' => $expertAccess ? 'pending' : 'not_requested',
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
}
