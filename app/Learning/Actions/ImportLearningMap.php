<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningActivityTranslation;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningTopic;
use App\Models\LearningWorld;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ImportLearningMap
{
    public function __construct(private readonly UniqueSlugGenerator $slugGenerator) {}

    /**
     * Import one validated manifest as a new map in the current workspace.
     * Learner state, review state, versions and editor groups are intentionally
     * not part of the manifest import boundary.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $data
     */
    public function handle(array $payload, LearningWorld $world, array $data, User $creator): LearningMap
    {
        return DB::transaction(function () use ($creator, $data, $payload, $world): LearningMap {
            $map = $this->createDestinationMap($payload, $world, $data, $creator);
            $this->populateMap($payload, $world, $map);

            return $map->refresh();
        });
    }

    /**
     * Create the destination map without importing its child records.
     * Callers importing multiple maps can create every destination first so
     * cross-map portal references can be remapped in one transaction.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $data
     */
    public function createDestinationMap(
        array $payload,
        LearningWorld $world,
        array $data,
        User $creator,
    ): LearningMap {
        $mapPayload = is_array($payload['map'] ?? null) ? $payload['map'] : [];
        $topicSlug = is_string($mapPayload['topicSlug'] ?? null) ? $mapPayload['topicSlug'] : null;
        $topic = $topicSlug === null
            ? null
            : LearningTopic::query()->where('slug', $topicSlug)->firstOrFail();

        return LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'learning_topic_id' => $topic?->id,
            'created_by_user_id' => $creator->id,
            'updated_by_user_id' => $creator->id,
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forMap($world, (string) $data['title']),
            'title' => trim((string) $data['title']),
            'description' => $mapPayload['description'] ?? null,
            'background_config' => $mapPayload['backgroundConfig'] ?? [],
            'grid_config' => $mapPayload['gridConfig'] ?? [],
            // Access restrictions are controlled by the destination authoring
            // boundary, not by an uploaded file from another context.
            'access_roles' => null,
            'time_background_enabled' => (bool) ($mapPayload['timeBackgroundEnabled'] ?? false),
            'map_assets_locked' => (bool) ($mapPayload['mapAssetsLocked'] ?? false),
            'companion_config' => $mapPayload['companionConfig'] ?? null,
        ]);
    }

    /**
     * Import child records into a destination map.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $mapSlugMap  Source map slug to destination map slug.
     * @return array{nodeIds: array<string, int>, activityIds: array<string, int>, assetIds: array<string, int>}
     */
    public function populateMap(
        array $payload,
        LearningWorld $world,
        LearningMap $map,
        array $mapSlugMap = [],
        bool $importPortals = true,
    ): array {
        $nodeIds = $this->importNodes($payload['nodes'] ?? [], $map);
        $assetIds = [];
        $messageTopicIds = $this->importAssets($payload['mapAssets'] ?? [], $map, $nodeIds, $assetIds);
        $activityIds = $this->importActivities(
            $payload['nodes'] ?? [],
            $nodeIds,
            $messageTopicIds,
        );

        $this->importActivityTransitions($payload['nodes'] ?? [], $activityIds);
        $this->importActivityStarts($payload['nodes'] ?? [], $nodeIds, $activityIds);
        if ($importPortals) {
            $this->populatePortals($payload, $world, $map, $nodeIds, $activityIds, $mapSlugMap);
        }

        return [
            'nodeIds' => $nodeIds,
            'activityIds' => $activityIds,
            'assetIds' => $assetIds,
        ];
    }

    /**
     * Import portal links after all destination maps have their nodes.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, int>  $nodeIds
     * @param  array<string, int>  $activityIds
     * @param  array<string, string>  $mapSlugMap  Source map slug to destination map slug.
     */
    public function populatePortals(
        array $payload,
        LearningWorld $world,
        LearningMap $map,
        array $nodeIds,
        array $activityIds,
        array $mapSlugMap = [],
    ): void {
        $this->importPortalLinks(
            $payload['portalTargets'] ?? [],
            $world,
            $map,
            (string) data_get($payload, 'map.slug', ''),
            $nodeIds,
            $activityIds,
            $mapSlugMap,
        );
    }

    /**
     * @return array<string, int>
     */
    private function importNodes(mixed $nodesValue, LearningMap $map): array
    {
        $nodeIds = [];

        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
                continue;
            }

            $copy = LearningNode::query()->create([
                'learning_map_id' => $map->id,
                'slug' => $node['slug'],
                'title' => $node['title'] ?? $node['slug'],
                'description' => $node['description'] ?? null,
                'position_q' => (int) data_get($node, 'position.q', 0),
                'position_r' => (int) data_get($node, 'position.r', 0),
                'state' => $node['state'] ?? 'available',
                'visual_config' => $this->remapNodeReferences($node['visualConfig'] ?? [], $nodeIds),
                'activity_graph_layout' => $node['activityGraphLayout'] ?? [],
                'companion_config' => $node['companionConfig'] ?? null,
                'start_activity_id' => null,
            ]);

            $nodeIds[$node['slug']] = $copy->id;
            if (is_numeric($node['sourceId'] ?? null)) {
                $nodeIds['#'.(int) $node['sourceId']] = $copy->id;
            }
        }

        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
                continue;
            }

            $copyId = $nodeIds[$node['slug']] ?? null;
            if ($copyId === null) {
                continue;
            }

            LearningNode::query()->whereKey($copyId)->update([
                'visual_config' => $this->remapNodeReferences($node['visualConfig'] ?? [], $nodeIds),
            ]);
        }

        return $nodeIds;
    }

    /**
     * @param  array<string, int>  $nodeIds
     * @param  array<string, int>  $assetIds
     * @return array<string, int>
     */
    private function importAssets(mixed $assetsValue, LearningMap $map, array $nodeIds, array &$assetIds): array
    {
        $messageTopicIds = [];

        foreach (is_array($assetsValue) ? $assetsValue : [] as $asset) {
            if (! is_array($asset)) {
                continue;
            }

            $copy = LearningMapAsset::query()->create([
                'learning_map_id' => $map->id,
                'learning_node_id' => is_string($asset['nodeSlug'] ?? null)
                    ? ($nodeIds[$asset['nodeSlug']] ?? null)
                    : null,
                'image_url' => $asset['imageUrl'] ?? null,
                'text' => $asset['text'] ?? null,
                'position_x' => $asset['x'] ?? 50,
                'position_y' => $asset['y'] ?? 50,
                'position_z' => $asset['z'] ?? 0,
                'width' => $asset['width'] ?? 14,
                'opacity' => $asset['opacity'] ?? 1,
                'locked' => (bool) ($asset['locked'] ?? false),
                'focusable' => (bool) ($asset['focusable'] ?? false),
                'interaction_mode' => $asset['interactionMode'] ?? null,
                'interaction_config' => $asset['interactionConfig'] ?? [],
                'visual_config' => $asset['visualConfig'] ?? [],
                'sound_config' => $asset['soundConfig'] ?? [],
            ]);

            if (is_numeric($asset['sourceId'] ?? null)) {
                $assetIds['#'.(int) $asset['sourceId']] = $copy->id;
            }

            foreach (is_array($asset['messageTopics'] ?? null) ? $asset['messageTopics'] : [] as $topic) {
                if (! is_array($topic) || ! is_string($topic['slug'] ?? null)) {
                    continue;
                }

                $topicCopy = LearningMessageTopic::query()->create([
                    'learning_map_asset_id' => $copy->id,
                    'slug' => $topic['slug'],
                    'title' => $topic['title'] ?? $topic['slug'],
                ]);

                if (is_numeric($topic['sourceId'] ?? null)) {
                    $messageTopicIds['#'.(int) $topic['sourceId']] = $topicCopy->id;
                }
            }
        }

        return $messageTopicIds;
    }

    /**
     * @param  array<string, int>  $nodeIds
     * @param  array<string, int>  $messageTopicIds
     * @return array<string, int>
     */
    private function importActivities(mixed $nodesValue, array $nodeIds, array $messageTopicIds): array
    {
        $activityIds = [];

        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
                continue;
            }

            foreach (is_array($node['activities'] ?? null) ? $node['activities'] : [] as $activity) {
                if (! is_array($activity) || ! is_string($activity['slug'] ?? null)) {
                    continue;
                }

                $copy = LearningActivity::query()->create([
                    'learning_node_id' => $nodeIds[$node['slug']],
                    'slug' => $activity['slug'],
                    'type' => $activity['type'] ?? 'markdown',
                    'title' => $activity['title'] ?? $activity['slug'],
                    'introduction' => $activity['introduction'] ?? null,
                    'config' => $this->remapMessageTopicReferences($activity['config'] ?? [], $messageTopicIds),
                    'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW,
                    'ai_reviewed_at' => null,
                    'ai_review' => null,
                    'sort_order' => $activity['sortOrder'] ?? 0,
                    'graph_position_x' => data_get($activity, 'graphPosition.x'),
                    'graph_position_y' => data_get($activity, 'graphPosition.y'),
                    'companion_config' => $activity['companionConfig'] ?? null,
                ]);

                $key = $node['slug'].':'.$activity['slug'];
                $activityIds[$key] = $copy->id;
                if (is_numeric($activity['sourceId'] ?? null)) {
                    $activityIds['#'.(int) $activity['sourceId']] = $copy->id;
                }

                $this->importQuestion($activity['question'] ?? null, $copy);
                $dialogueNodeIds = $this->importDialogueNodes($activity['dialogueNodes'] ?? [], $copy);
                $this->importDialogueTransitions($activity['dialogueTransitions'] ?? [], $copy, $dialogueNodeIds);
                $this->importTranslations($activity['translations'] ?? [], $copy);
            }
        }

        return $activityIds;
    }

    private function importQuestion(mixed $questionValue, LearningActivity $activity): void
    {
        if (! is_array($questionValue)) {
            return;
        }

        $question = LearningQuestion::query()->create([
            'learning_activity_id' => $activity->id,
            'prompt' => $questionValue['prompt'] ?? '',
            'feedback_correct' => $questionValue['feedbackCorrect'] ?? null,
            'feedback_incorrect' => $questionValue['feedbackIncorrect'] ?? null,
            'explanation' => $questionValue['explanation'] ?? null,
            'allow_multiple' => (bool) ($questionValue['allowMultiple'] ?? false),
        ]);

        foreach (is_array($questionValue['options'] ?? null) ? $questionValue['options'] : [] as $option) {
            if (! is_array($option)) {
                continue;
            }

            LearningQuestionOption::query()->create([
                'learning_question_id' => $question->id,
                'label' => $option['label'] ?? '',
                'body' => $option['body'] ?? null,
                'is_correct' => (bool) ($option['isCorrect'] ?? false),
                'outcome_key' => $option['outcomeKey'] ?? null,
                'feedback' => $option['feedback'] ?? null,
                'weights' => $option['weights'] ?? [],
                'sort_order' => $option['sortOrder'] ?? 0,
            ]);
        }
    }

    /**
     * @return array<string, int>
     */
    private function importDialogueNodes(mixed $nodesValue, LearningActivity $activity): array
    {
        $dialogueNodeIds = [];

        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_numeric($node['sourceId'] ?? null)) {
                continue;
            }

            $copy = NpcDialogueNode::query()->create([
                'learning_activity_id' => $activity->id,
                'type' => $node['type'] ?? 'message',
                'title' => $node['title'] ?? 'Dialogue node',
                'body' => $node['body'] ?? null,
                'config' => $node['config'] ?? [],
                'sort_order' => $node['sortOrder'] ?? 0,
                'graph_position_x' => data_get($node, 'graphPosition.x'),
                'graph_position_y' => data_get($node, 'graphPosition.y'),
            ]);
            $dialogueNodeIds['#'.(int) $node['sourceId']] = $copy->id;
        }

        return $dialogueNodeIds;
    }

    /** @param array<string, int> $dialogueNodeIds */
    private function importDialogueTransitions(mixed $transitionsValue, LearningActivity $activity, array $dialogueNodeIds): void
    {
        foreach (is_array($transitionsValue) ? $transitionsValue : [] as $transition) {
            if (! is_array($transition) || ! is_numeric($transition['toSourceId'] ?? null)) {
                continue;
            }

            $targetId = $dialogueNodeIds['#'.(int) $transition['toSourceId']] ?? null;
            if ($targetId === null) {
                continue;
            }

            NpcDialogueTransition::query()->create([
                'learning_activity_id' => $activity->id,
                'from_dialogue_node_id' => is_numeric($transition['fromSourceId'] ?? null)
                    ? ($dialogueNodeIds['#'.(int) $transition['fromSourceId']] ?? null)
                    : null,
                'to_dialogue_node_id' => $targetId,
                'from_connector' => $transition['fromConnector'] ?? 'out',
                'to_connector' => $transition['toConnector'] ?? 'in',
            ]);
        }
    }

    private function importTranslations(mixed $translationsValue, LearningActivity $activity): void
    {
        foreach (is_array($translationsValue) ? $translationsValue : [] as $translation) {
            if (! is_array($translation) || ! is_string($translation['locale'] ?? null)) {
                continue;
            }

            LearningActivityTranslation::query()->create([
                'learning_activity_id' => $activity->id,
                'locale' => $translation['locale'],
                'content' => $translation['content'] ?? [],
            ]);
        }
    }

    /** @param array<string, int> $activityIds */
    private function importActivityTransitions(mixed $nodesValue, array $activityIds): void
    {
        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
                continue;
            }

            foreach (is_array($node['activities'] ?? null) ? $node['activities'] : [] as $activity) {
                if (! is_array($activity) || ! is_string($activity['slug'] ?? null)) {
                    continue;
                }

                $fromId = $activityIds[$node['slug'].':'.$activity['slug']] ?? null;
                if ($fromId === null) {
                    continue;
                }

                foreach (is_array($activity['transitions'] ?? null) ? $activity['transitions'] : [] as $transition) {
                    $targetSlug = $transition['toActivitySlug'] ?? null;
                    $toId = is_string($targetSlug)
                        ? ($activityIds[$node['slug'].':'.$targetSlug] ?? null)
                        : null;
                    if ($toId === null) {
                        continue;
                    }

                    ActivityTransition::query()->create([
                        'from_activity_id' => $fromId,
                        'to_activity_id' => $toId,
                        'from_connector' => $transition['fromConnector'] ?? 'out',
                        'to_connector' => $transition['toConnector'] ?? 'in',
                        'trigger' => $transition['trigger'] ?? null,
                        'trigger_value' => $transition['triggerValue'] ?? null,
                        'label' => $transition['label'] ?? null,
                        'rules' => $transition['rules'] ?? [],
                    ]);
                }
            }
        }
    }

    /**
     * @param  array<string, int>  $nodeIds
     * @param  array<string, int>  $activityIds
     */
    private function importActivityStarts(mixed $nodesValue, array $nodeIds, array $activityIds): void
    {
        foreach (is_array($nodesValue) ? $nodesValue : [] as $node) {
            if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
                continue;
            }

            $newNodeId = $nodeIds[$node['slug']] ?? null;
            if ($newNodeId === null) {
                continue;
            }

            $startActivitySlug = $node['startActivitySlug'] ?? null;
            if (is_string($startActivitySlug)) {
                LearningNode::query()->whereKey($newNodeId)->update([
                    'start_activity_id' => $activityIds[$node['slug'].':'.$startActivitySlug] ?? null,
                ]);
            }

            foreach (is_array($node['activityStarts'] ?? null) ? $node['activityStarts'] : [] as $start) {
                if (! is_array($start) || ! is_string($start['activitySlug'] ?? null)) {
                    continue;
                }

                $activityId = $activityIds[$node['slug'].':'.$start['activitySlug']] ?? null;
                if ($activityId === null) {
                    continue;
                }

                LearningActivityStart::query()->firstOrCreate(
                    [
                        'learning_node_id' => $newNodeId,
                        'learning_activity_id' => $activityId,
                    ],
                    [
                        'label' => $start['label'] ?? null,
                        'description' => $start['description'] ?? null,
                        'image_dark' => $start['imageDark'] ?? null,
                        'image_light' => $start['imageLight'] ?? null,
                        'button_color_dark' => $start['buttonColorDark'] ?? null,
                        'button_border_color_dark' => $start['buttonBorderColorDark'] ?? null,
                        'button_color_light' => $start['buttonColorLight'] ?? null,
                        'button_border_color_light' => $start['buttonBorderColorLight'] ?? null,
                        'sort_order' => $start['sortOrder'] ?? 0,
                    ],
                );
            }

            $legacyStartActivityId = is_string($startActivitySlug)
                ? ($activityIds[$node['slug'].':'.$startActivitySlug] ?? null)
                : null;

            if ($legacyStartActivityId !== null) {
                LearningActivityStart::query()->firstOrCreate(
                    [
                        'learning_node_id' => $newNodeId,
                        'learning_activity_id' => $legacyStartActivityId,
                    ],
                    [
                        'label' => null,
                        'sort_order' => 10,
                    ],
                );
            }
        }
    }

    /**
     * @param  array<string, int>  $nodeIds
     * @param  array<string, int>  $activityIds
     * @param  array<string, string>  $mapSlugMap  Source map slug to destination map slug.
     */
    private function importPortalLinks(
        mixed $portalsValue,
        LearningWorld $world,
        LearningMap $map,
        string $sourceMapSlug,
        array $nodeIds,
        array $activityIds,
        array $mapSlugMap = [],
    ): void {
        foreach (is_array($portalsValue) ? $portalsValue : [] as $portal) {
            if (! is_array($portal) || ! is_string($portal['sourceNodeSlug'] ?? null)) {
                continue;
            }

            $sourceNodeId = $nodeIds[$portal['sourceNodeSlug']] ?? null;
            if ($sourceNodeId === null) {
                continue;
            }

            $sourceActivityId = is_string($portal['sourceActivitySlug'] ?? null)
                ? ($activityIds[$portal['sourceNodeSlug'].':'.$portal['sourceActivitySlug']] ?? null)
                : null;
            $targetMapSlug = $portal['targetMapSlug'] ?? null;
            $targetNodeSlug = $portal['targetNodeSlug'] ?? null;
            if (! is_string($targetMapSlug) || ! is_string($targetNodeSlug)) {
                continue;
            }

            if ($targetMapSlug === $sourceMapSlug) {
                $targetMap = $map;
                $targetNodeId = $nodeIds[$targetNodeSlug] ?? null;
            } else {
                $destinationTargetMapSlug = $mapSlugMap[$targetMapSlug] ?? $targetMapSlug;
                $targetMap = LearningMap::query()
                    ->where('learning_world_id', $world->id)
                    ->where('slug', $destinationTargetMapSlug)
                    ->first();
                $targetNodeId = $targetMap?->nodes()->where('slug', $targetNodeSlug)->value('id');
            }

            if ($targetMap === null || $targetNodeId === null) {
                continue;
            }

            $targetActivityId = null;
            if (is_string($portal['targetActivitySlug'] ?? null)) {
                $targetActivityId = LearningActivity::query()
                    ->where('learning_node_id', $targetNodeId)
                    ->where('slug', $portal['targetActivitySlug'])
                    ->value('id');
            }

            LearningPortalLink::query()->create([
                'source_learning_node_id' => $sourceNodeId,
                'target_learning_node_id' => $targetNodeId,
                'source_learning_activity_id' => $sourceActivityId,
                'target_learning_activity_id' => $targetActivityId,
                'label' => $portal['label'] ?? null,
                'description' => $portal['description'] ?? null,
                'config' => $portal['config'] ?? [],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<string, int>  $nodeIds
     * @return array<string, mixed>|null
     */
    private function remapNodeReferences(?array $value, array $nodeIds): ?array
    {
        return $this->remapReferences($value, $nodeIds, ['nodeId'], ['requiredNodeIds']);
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<string, int>  $messageTopicIds
     * @return array<string, mixed>|null
     */
    private function remapMessageTopicReferences(?array $value, array $messageTopicIds): ?array
    {
        return $this->remapReferences($value, $messageTopicIds, ['messageTopicId'], []);
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @param  array<string, int>  $referenceIds
     * @param  list<string>  $singleKeys
     * @param  list<string>  $listKeys
     * @return array<string, mixed>|null
     */
    private function remapReferences(?array $value, array $referenceIds, array $singleKeys, array $listKeys): ?array
    {
        if ($value === null) {
            return null;
        }

        foreach ($value as $key => $nested) {
            if (in_array((string) $key, $singleKeys, true) && is_numeric($nested)) {
                $value[$key] = $referenceIds['#'.(int) $nested] ?? $nested;
            } elseif (in_array((string) $key, $listKeys, true) && is_array($nested)) {
                $value[$key] = array_map(
                    fn (mixed $id): mixed => is_numeric($id)
                        ? ($referenceIds['#'.(int) $id] ?? $id)
                        : $id,
                    $nested,
                );
            } elseif (is_array($nested)) {
                $value[$key] = $this->remapReferences($nested, $referenceIds, $singleKeys, $listKeys);
            }
        }

        return $value;
    }
}
