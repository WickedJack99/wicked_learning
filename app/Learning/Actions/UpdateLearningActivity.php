<?php

namespace App\Learning\Actions;

use App\Learning\Services\ActivityAmbientSoundConfiguration;
use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Learning\Services\ActivityCompletionChoiceConfiguration;
use App\Learning\Services\ActivityFeedbackGuidanceConfiguration;
use App\Learning\Services\ActivitySourceReferenceConfiguration;
use App\Learning\Services\ActivityTimeGuideConfiguration;
use App\Learning\Services\ItemGrantActivityConfiguration;
use App\Learning\Services\ItemObstacleActivityConfiguration;
use App\Learning\Services\LearningActivityReviewState;
use App\Learning\Services\MarkdownActivityConfiguration;
use App\Learning\Services\MessageActivityConfiguration;
use App\Learning\Services\NpcDialogueConfiguration;
use App\Learning\Services\ObstacleActivityConfiguration;
use App\Learning\Services\OpenPracticeActivityConfiguration;
use App\Learning\Services\PortalActivityConfiguration;
use App\Learning\Services\PortalLinkService;
use App\Learning\Services\QuestionActivityConfiguration;
use App\Learning\Services\ReflectionActivityConfiguration;
use App\Learning\Services\SharedTaskActivityConfiguration;
use App\Learning\Services\ToolGrantActivityConfiguration;
use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateLearningActivity
{
    public function __construct(
        private readonly NpcDialogueConfiguration $npcDialogueConfig,
        private readonly ActivityAmbientSoundConfiguration $ambientSoundConfig,
        private readonly ActivityCompetenceConfiguration $competenceConfig,
        private readonly ActivityCompletionChoiceConfiguration $completionChoiceConfig,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidanceConfig,
        private readonly ActivitySourceReferenceConfiguration $sourceReferenceConfig,
        private readonly ActivityTimeGuideConfiguration $timeGuideConfig,
        private readonly LearningActivityReviewState $reviewState,
        private readonly EnsureCompetenceTopicDefinitions $ensureCompetenceTopics,
        private readonly MarkdownActivityConfiguration $markdownConfig,
        private readonly MessageActivityConfiguration $messageConfig,
        private readonly ItemGrantActivityConfiguration $itemGrantConfig,
        private readonly ItemObstacleActivityConfiguration $itemObstacleConfig,
        private readonly ObstacleActivityConfiguration $obstacleConfig,
        private readonly OpenPracticeActivityConfiguration $openPracticeConfig,
        private readonly ToolGrantActivityConfiguration $toolGrantConfig,
        private readonly PortalActivityConfiguration $portalConfig,
        private readonly QuestionActivityConfiguration $questionConfig,
        private readonly ReflectionActivityConfiguration $reflectionConfig,
        private readonly SharedTaskActivityConfiguration $sharedTaskConfig,
        private readonly PortalLinkService $portalLinkService,
        private readonly UniqueSlugGenerator $slugGenerator,
        private readonly RecordLearningActivityVersion $recordVersion,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(
        LearningActivity $activity,
        array $data,
        ?User $user = null,
        ?string $expectedUpdatedAt = null,
    ): LearningActivity {
        return DB::transaction(function () use ($activity, $data, $expectedUpdatedAt, $user): LearningActivity {
            $currentActivity = LearningActivity::query()
                ->whereKey($activity->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $expectedUpdatedAt !== null
                && $currentActivity->updated_at?->toIso8601String() !== Carbon::parse($expectedUpdatedAt)->toIso8601String()
            ) {
                throw ValidationException::withMessages([
                    'updated_at' => 'This activity changed while you were editing. Reload it before saving again.',
                ]);
            }

            $currentActivity->loadMissing('node');
            $updates = $this->updatesFor($currentActivity, $data);
            $questionChanged = $this->questionConfig->willChange($currentActivity, $data, $updates);
            $snapshot = $this->recordVersion->snapshot($currentActivity);

            $currentActivity->forceFill($updates);

            if ($currentActivity->isDirty() || $questionChanged) {
                if (
                    $user instanceof User
                    && ($this->reviewState->hasContentChanges($currentActivity)
                        || $questionChanged
                        || $currentActivity->isDirty([
                            'companion_config',
                            'graph_position_x',
                            'graph_position_y',
                        ]))
                ) {
                    $this->recordVersion->handle($user, $currentActivity, $snapshot);
                }

                if ($this->reviewState->hasContentChanges($currentActivity) || $questionChanged) {
                    $this->reviewState->markNeedsReview($currentActivity);
                } else {
                    $currentActivity->save();
                }
            }

            $this->questionConfig->sync($currentActivity, $data);
            $this->npcDialogueConfig->scaffoldDefaultEnd($currentActivity);
            $this->syncPortalLinkWhenNeeded($currentActivity, $data);
            $this->ensureCompetenceTopics->handle($this->competenceConfig->topicsForActivity($currentActivity));

            return $currentActivity->refresh();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function updatesFor(LearningActivity $activity, array $data): array
    {
        $updates = $this->basicUpdates($activity, $data);
        $type = (string) ($updates['type'] ?? $activity->type);

        if (
            $this->portalConfig->shouldUpdate($data, $updates)
            || $this->markdownConfig->shouldUpdate($data, $updates)
            || $this->messageConfig->shouldUpdate($data, $updates)
            || $this->itemGrantConfig->shouldUpdate($data, $updates)
            || $this->itemObstacleConfig->shouldUpdate($data, $updates)
            || $this->obstacleConfig->shouldUpdate($data, $updates)
            || $this->toolGrantConfig->shouldUpdate($data, $updates)
            || $this->openPracticeConfig->shouldUpdate($data, $updates)
            || $this->reflectionConfig->shouldUpdate($data, $updates)
            || $this->sharedTaskConfig->shouldUpdate($data, $updates)
            || $this->ambientSoundConfig->shouldUpdate($data)
            || $this->competenceConfig->shouldUpdate($data)
            || $this->feedbackGuidanceConfig->shouldUpdate($data)
            || $this->completionChoiceConfig->shouldUpdate($data)
            || $this->sourceReferenceConfig->shouldUpdate($data)
            || $this->timeGuideConfig->shouldUpdate($data)
        ) {
            $config = is_array($activity->config) ? $activity->config : [];
            $updates['config'] = $this->configFor($activity->node, $type, $data, $config);
        }

        return $updates;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    private function configFor(LearningNode $node, string $type, array $data, array $existing): array
    {
        $config = match ($type) {
            'item_grant' => $this->itemGrantConfig->fromData($data, $existing),
            'item_obstacle' => $this->itemObstacleConfig->fromData($data, $existing),
            'markdown' => $this->markdownConfig->fromData($data, $existing),
            'message_prompt', 'message_wall' => $this->messageConfig->fromData($node, $data, $existing),
            'obstacle' => $this->obstacleConfig->fromData($data, $existing),
            'open_practice' => $this->openPracticeConfig->fromData($data, $existing),
            'portal' => $this->portalConfig->fromData($data, $existing),
            'reflection', 'review' => $this->reflectionConfig->fromData($data, $existing),
            'shared_task' => $this->sharedTaskConfig->fromData($data, $existing),
            'tool_grant' => $this->toolGrantConfig->fromData($data, $existing),
            default => [],
        };

        return $this->timeGuideConfig->mergeInto(
            $this->competenceConfig->mergeInto(
                $this->completionChoiceConfig->mergeInto(
                    $this->feedbackGuidanceConfig->mergeInto(
                        $this->sourceReferenceConfig->mergeInto(
                            $this->ambientSoundConfig->mergeInto($config, $data),
                            $data,
                        ),
                        $data,
                    ),
                    $data,
                ),
                $data,
            ),
            $data,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function basicUpdates(LearningActivity $activity, array $data): array
    {
        $updates = [];

        foreach (['title', 'type', 'introduction', 'graph_position_x', 'graph_position_y'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        if (array_key_exists('slug', $data)) {
            $title = (string) ($data['title'] ?? $activity->title);
            $updates['slug'] = ($data['slug'] ?? null) ?: $this->slugGenerator->forActivity($activity->node, $title, $activity);
        }

        return $updates;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncPortalLinkWhenNeeded(LearningActivity $activity, array $data): void
    {
        $shouldSync = array_intersect_key($data, array_flip([
            'type',
            'portal_mode',
            'target_portal_activity_id',
            'title',
        ])) !== [];

        if (! $shouldSync) {
            return;
        }

        $activity->refresh();
        $this->portalLinkService->syncForActivity($activity, $data['target_portal_activity_id'] ?? null);
    }
}
