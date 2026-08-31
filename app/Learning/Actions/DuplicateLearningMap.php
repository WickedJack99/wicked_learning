<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningActivityTranslation;
use App\Models\LearningCompanionDialogueAssignment;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DuplicateLearningMap
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningMap $source, array $data, User $creator): LearningMap
    {
        $source->load([
            'world',
            'nodes.activities.npcDialogueNodes',
            'nodes.activities.npcDialogueTransitions',
            'nodes.activities.question.options',
            'nodes.activities.transitions',
            'nodes.activities.translations',
            'nodes.activityStarts',
            'assets.messageTopics',
        ]);

        $sourceNodeIds = $source->nodes->pluck('id')->all();
        $sourceActivityIds = $source->nodes
            ->flatMap(fn (LearningNode $node) => $node->activities)
            ->pluck('id')
            ->all();
        $assignments = LearningCompanionDialogueAssignment::query()
            ->where(function ($query) use ($source, $sourceNodeIds, $sourceActivityIds): void {
                $query->where(function ($query) use ($source): void {
                    $query->where('scope_type', 'map')->where('scope_id', $source->id);
                })->orWhere(function ($query) use ($sourceNodeIds): void {
                    $query->where('scope_type', 'node')->whereIn('scope_id', $sourceNodeIds);
                })->orWhere(function ($query) use ($sourceActivityIds): void {
                    $query->where('scope_type', 'activity')->whereIn('scope_id', $sourceActivityIds);
                });
            })
            ->get(['learning_companion_dialogue_id', 'scope_type', 'scope_id']);
        $portalLinks = $source->outgoingPortalLinks()
            ->get([
                'learning_portal_links.source_learning_node_id',
                'learning_portal_links.target_learning_node_id',
                'learning_portal_links.source_learning_activity_id',
                'learning_portal_links.target_learning_activity_id',
                'learning_portal_links.label',
                'learning_portal_links.description',
                'learning_portal_links.config',
            ]);

        return DB::transaction(function () use ($assignments, $creator, $data, $portalLinks, $source): LearningMap {
            $duplicate = LearningMap::query()->create([
                'learning_world_id' => $source->learning_world_id,
                'learning_topic_id' => $source->learning_topic_id,
                'created_by_user_id' => $creator->id,
                'updated_by_user_id' => $creator->id,
                'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forMap($source->world, (string) $data['title']),
                'title' => trim((string) $data['title']),
                'description' => $source->description,
                'background_config' => $source->background_config,
                'grid_config' => $source->grid_config,
                'access_roles' => $source->access_roles,
                'time_background_enabled' => $source->time_background_enabled,
                'map_assets_locked' => $source->map_assets_locked,
                'companion_config' => $source->companion_config,
            ]);

            $nodeIds = $this->duplicateNodes($source, $duplicate);
            $topicIds = $this->duplicateAssets($source, $duplicate, $nodeIds);
            $activityIds = $this->duplicateActivities($source, $nodeIds, $topicIds);
            $this->duplicateQuestions($source, $activityIds);

            $dialogueNodeIds = $this->duplicateDialogueNodes($source, $activityIds);
            $this->duplicateDialogueTransitions($source, $activityIds, $dialogueNodeIds);
            $this->duplicateActivityTranslations($source, $activityIds);
            $this->duplicateActivityTransitions($source, $activityIds);
            $this->duplicateActivityStarts($source, $nodeIds, $activityIds);
            $this->updateNodeStartActivities($source, $nodeIds, $activityIds);
            $this->duplicatePortalLinks($portalLinks, $nodeIds, $activityIds);
            $this->duplicateCompanionAssignments($assignments, $duplicate, $nodeIds, $activityIds);

            return $duplicate->refresh();
        });
    }

    /**
     * @return array<int, int>
     */
    private function duplicateNodes(LearningMap $source, LearningMap $duplicate): array
    {
        $nodeIds = [];

        foreach ($source->nodes as $node) {
            $copy = LearningNode::query()->create([
                'learning_map_id' => $duplicate->id,
                'slug' => $node->slug,
                'title' => $node->title,
                'description' => $node->description,
                'position_q' => $node->position_q,
                'position_r' => $node->position_r,
                'state' => $node->state,
                'visual_config' => $node->visual_config,
                'activity_graph_layout' => $node->activity_graph_layout,
                'companion_config' => $node->companion_config,
                'start_activity_id' => null,
            ]);
            $nodeIds[$node->id] = $copy->id;
        }

        foreach ($source->nodes as $node) {
            $copy = LearningNode::query()->findOrFail($nodeIds[$node->id]);
            $copy->forceFill([
                'visual_config' => $this->remapNodeReferences($node->visual_config, $nodeIds),
            ])->save();
        }

        return $nodeIds;
    }

    /**
     * @param  array<int, int>  $nodeIds
     * @return array<int, int>
     */
    private function duplicateAssets(LearningMap $source, LearningMap $duplicate, array $nodeIds): array
    {
        $topicIds = [];

        foreach ($source->assets as $asset) {
            $copy = LearningMapAsset::query()->create([
                'learning_map_id' => $duplicate->id,
                'learning_node_id' => $asset->learning_node_id !== null
                    ? ($nodeIds[$asset->learning_node_id] ?? null)
                    : null,
                'image_url' => $asset->image_url,
                'text' => $asset->text,
                'position_x' => $asset->position_x,
                'position_y' => $asset->position_y,
                'position_z' => $asset->position_z,
                'width' => $asset->width,
                'opacity' => $asset->opacity,
                'locked' => $asset->locked,
                'focusable' => $asset->focusable,
                'interaction_mode' => $asset->interaction_mode,
                'interaction_config' => $asset->interaction_config,
                'visual_config' => $asset->visual_config,
                'sound_config' => $asset->sound_config,
            ]);

            foreach ($asset->messageTopics as $topic) {
                $topicCopy = LearningMessageTopic::query()->create([
                    'learning_map_asset_id' => $copy->id,
                    'slug' => $topic->slug,
                    'title' => $topic->title,
                ]);
                $topicIds[$topic->id] = $topicCopy->id;
            }
        }

        return $topicIds;
    }

    /**
     * @param  array<int, int>  $nodeIds
     * @param  array<int, int>  $topicIds
     * @return array<int, int>
     */
    private function duplicateActivities(LearningMap $source, array $nodeIds, array $topicIds): array
    {
        $activityIds = [];

        foreach ($source->nodes as $node) {
            foreach ($node->activities as $activity) {
                $copy = LearningActivity::query()->create([
                    'learning_node_id' => $nodeIds[$node->id],
                    'slug' => $activity->slug,
                    'type' => $activity->type,
                    'title' => $activity->title,
                    'introduction' => $activity->introduction,
                    'config' => $this->remapMessageTopicReferences($activity->config, $topicIds),
                    'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW,
                    'ai_reviewed_at' => null,
                    'ai_review' => null,
                    'sort_order' => $activity->sort_order,
                    'graph_position_x' => $activity->graph_position_x,
                    'graph_position_y' => $activity->graph_position_y,
                    'companion_config' => $activity->companion_config,
                ]);
                $activityIds[$activity->id] = $copy->id;
            }
        }

        return $activityIds;
    }

    /** @param array<int, int> $activityIds */
    private function duplicateQuestions(LearningMap $source, array $activityIds): void
    {
        foreach ($this->sourceActivities($source) as $activity) {
            if (! $activity->question) {
                continue;
            }

            $question = $activity->question;
            $copy = LearningQuestion::query()->create([
                'learning_activity_id' => $activityIds[$activity->id],
                'prompt' => $question->prompt,
                'feedback_correct' => $question->feedback_correct,
                'feedback_incorrect' => $question->feedback_incorrect,
                'explanation' => $question->explanation,
                'allow_multiple' => $question->allow_multiple,
            ]);

            foreach ($question->options as $option) {
                LearningQuestionOption::query()->create([
                    'learning_question_id' => $copy->id,
                    'label' => $option->label,
                    'body' => $option->body,
                    'is_correct' => $option->is_correct,
                    'outcome_key' => $option->outcome_key,
                    'feedback' => $option->feedback,
                    'weights' => $option->weights,
                    'sort_order' => $option->sort_order,
                ]);
            }
        }
    }

    /**
     * @param  array<int, int>  $activityIds
     * @return array<int, int>
     */
    private function duplicateDialogueNodes(LearningMap $source, array $activityIds): array
    {
        $dialogueNodeIds = [];

        foreach ($this->sourceActivities($source) as $activity) {
            foreach ($activity->npcDialogueNodes as $node) {
                $copy = NpcDialogueNode::query()->create([
                    'learning_activity_id' => $activityIds[$activity->id],
                    'type' => $node->type,
                    'title' => $node->title,
                    'body' => $node->body,
                    'config' => $node->config,
                    'sort_order' => $node->sort_order,
                    'graph_position_x' => $node->graph_position_x,
                    'graph_position_y' => $node->graph_position_y,
                ]);
                $dialogueNodeIds[$node->id] = $copy->id;
            }
        }

        return $dialogueNodeIds;
    }

    /**
     * @param  array<int, int>  $activityIds
     * @param  array<int, int>  $dialogueNodeIds
     */
    private function duplicateDialogueTransitions(
        LearningMap $source,
        array $activityIds,
        array $dialogueNodeIds,
    ): void {
        foreach ($this->sourceActivities($source) as $activity) {
            foreach ($activity->npcDialogueTransitions as $transition) {
                NpcDialogueTransition::query()->create([
                    'learning_activity_id' => $activityIds[$activity->id],
                    'from_dialogue_node_id' => $transition->from_dialogue_node_id !== null
                        ? $dialogueNodeIds[$transition->from_dialogue_node_id]
                        : null,
                    'to_dialogue_node_id' => $dialogueNodeIds[$transition->to_dialogue_node_id],
                    'from_connector' => $transition->from_connector,
                    'to_connector' => $transition->to_connector,
                ]);
            }
        }
    }

    /** @param array<int, int> $activityIds */
    private function duplicateActivityTranslations(LearningMap $source, array $activityIds): void
    {
        foreach ($this->sourceActivities($source) as $activity) {
            foreach ($activity->translations as $translation) {
                LearningActivityTranslation::query()->create([
                    'learning_activity_id' => $activityIds[$activity->id],
                    'locale' => $translation->locale,
                    'content' => $translation->content,
                ]);
            }
        }
    }

    /** @param array<int, int> $activityIds */
    private function duplicateActivityTransitions(LearningMap $source, array $activityIds): void
    {
        foreach ($this->sourceActivities($source) as $activity) {
            foreach ($activity->transitions as $transition) {
                ActivityTransition::query()->create([
                    'from_activity_id' => $activityIds[$transition->from_activity_id],
                    'to_activity_id' => $transition->to_activity_id !== null
                        ? $activityIds[$transition->to_activity_id]
                        : null,
                    'from_connector' => $transition->from_connector,
                    'to_connector' => $transition->to_connector,
                    'trigger' => $transition->trigger,
                    'trigger_value' => $transition->trigger_value,
                    'label' => $transition->label,
                    'rules' => $transition->rules,
                ]);
            }
        }
    }

    /**
     * @param  array<int, int>  $nodeIds
     * @param  array<int, int>  $activityIds
     */
    private function duplicateActivityStarts(LearningMap $source, array $nodeIds, array $activityIds): void
    {
        foreach ($source->nodes as $node) {
            foreach ($node->activityStarts as $start) {
                LearningActivityStart::query()->create([
                    'learning_node_id' => $nodeIds[$node->id],
                    'learning_activity_id' => $activityIds[$start->learning_activity_id],
                    'label' => $start->label,
                    'image_dark' => $start->image_dark,
                    'image_light' => $start->image_light,
                    'button_color_dark' => $start->button_color_dark,
                    'button_border_color_dark' => $start->button_border_color_dark,
                    'button_color_light' => $start->button_color_light,
                    'button_border_color_light' => $start->button_border_color_light,
                    'sort_order' => $start->sort_order,
                ]);
            }
        }
    }

    /**
     * @param  array<int, int>  $nodeIds
     * @param  array<int, int>  $activityIds
     */
    private function updateNodeStartActivities(LearningMap $source, array $nodeIds, array $activityIds): void
    {
        foreach ($source->nodes as $node) {
            if ($node->start_activity_id === null) {
                continue;
            }

            LearningNode::query()->whereKey($nodeIds[$node->id])->update([
                'start_activity_id' => $activityIds[$node->start_activity_id],
            ]);
        }
    }

    /**
     * @param  Collection<int, LearningPortalLink>  $portalLinks
     * @param  array<int, int>  $nodeIds
     * @param  array<int, int>  $activityIds
     */
    private function duplicatePortalLinks($portalLinks, array $nodeIds, array $activityIds): void
    {
        foreach ($portalLinks as $portalLink) {
            LearningPortalLink::query()->create([
                'source_learning_node_id' => $nodeIds[$portalLink->source_learning_node_id],
                'target_learning_node_id' => $nodeIds[$portalLink->target_learning_node_id]
                    ?? $portalLink->target_learning_node_id,
                'source_learning_activity_id' => $portalLink->source_learning_activity_id !== null
                    ? $activityIds[$portalLink->source_learning_activity_id]
                    : null,
                'target_learning_activity_id' => $portalLink->target_learning_activity_id !== null
                    ? ($activityIds[$portalLink->target_learning_activity_id] ?? $portalLink->target_learning_activity_id)
                    : null,
                'label' => $portalLink->label,
                'description' => $portalLink->description,
                'config' => $portalLink->config,
            ]);
        }
    }

    /**
     * @param  Collection<int, LearningCompanionDialogueAssignment>  $assignments
     * @param  array<int, int>  $nodeIds
     * @param  array<int, int>  $activityIds
     */
    private function duplicateCompanionAssignments(
        $assignments,
        LearningMap $duplicate,
        array $nodeIds,
        array $activityIds,
    ): void {
        foreach ($assignments as $assignment) {
            $scopeId = match ($assignment->scope_type) {
                'map' => $duplicate->id,
                'node' => $nodeIds[$assignment->scope_id] ?? null,
                'activity' => $activityIds[$assignment->scope_id] ?? null,
                default => null,
            };

            if ($scopeId === null) {
                continue;
            }

            LearningCompanionDialogueAssignment::query()->create([
                'learning_companion_dialogue_id' => $assignment->learning_companion_dialogue_id,
                'scope_type' => $assignment->scope_type,
                'scope_id' => $scopeId,
            ]);
        }
    }

    /**
     * @return array<int, LearningActivity>
     */
    private function sourceActivities(LearningMap $source): array
    {
        return $source->nodes
            ->flatMap(fn (LearningNode $node) => $node->activities)
            ->all();
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<int, int>  $nodeIds
     * @return array<string, mixed>|null
     */
    private function remapNodeReferences(?array $value, array $nodeIds): ?array
    {
        return $this->remapReferences($value, $nodeIds, ['nodeId', 'node_id'], ['requiredNodeIds']);
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<int, int>  $topicIds
     * @return array<string, mixed>|null
     */
    private function remapMessageTopicReferences(?array $value, array $topicIds): ?array
    {
        if ($value === null) {
            return null;
        }

        foreach ($value as $key => $nested) {
            if ($key === 'messageTopicId' && is_numeric($nested)) {
                $value[$key] = $topicIds[(int) $nested] ?? $nested;

                continue;
            }

            if (is_array($nested)) {
                $value[$key] = $this->remapMessageTopicReferences($nested, $topicIds);
            }
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<int, int>  $referenceIds
     * @param  list<string>  $singleKeys
     * @param  list<string>  $listKeys
     * @return array<string, mixed>|null
     */
    private function remapReferences(
        ?array $value,
        array $referenceIds,
        array $singleKeys,
        array $listKeys,
    ): ?array {
        if ($value === null) {
            return null;
        }

        foreach ($value as $key => $nested) {
            if (in_array((string) $key, $singleKeys, true) && is_numeric($nested)) {
                $value[$key] = $referenceIds[(int) $nested] ?? $nested;

                continue;
            }

            if (in_array((string) $key, $listKeys, true) && is_array($nested)) {
                $value[$key] = array_map(
                    fn (mixed $id): mixed => is_numeric($id)
                        ? ($referenceIds[(int) $id] ?? $id)
                        : $id,
                    $nested,
                );

                continue;
            }

            if (is_array($nested)) {
                $value[$key] = $this->remapReferences($nested, $referenceIds, $singleKeys, $listKeys);
            }
        }

        return $value;
    }
}
