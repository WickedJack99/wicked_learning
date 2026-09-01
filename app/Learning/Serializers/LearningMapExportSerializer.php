<?php

namespace App\Learning\Serializers;

use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningActivityTranslation;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningQuestionOption;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class LearningMapExportSerializer
{
    /**
     * @param  list<array<string, mixed>>|null  $portalTargets
     * @return array<string, mixed>
     */
    public function serialize(LearningMap $map, ?array $portalTargets = null): array
    {
        $map->loadMissing([
            'world',
            'topic',
            'nodes.activities.transitions.toActivity',
            'nodes.activityStarts.activity',
            'nodes.activities.question.options',
            'nodes.activities.npcDialogueNodes',
            'nodes.activities.npcDialogueTransitions',
            'nodes.activities.translations',
            'assets',
            'assets.messageTopics',
        ]);

        $nodes = $map->nodes->sortBy('id')->values();
        $nodeSlugs = $nodes->pluck('slug', 'id')->all();
        $portalTargets ??= $this->loadPortalTargets($map);

        $nodeExports = $nodes->map(function (LearningNode $node): array {
            $activities = $node->activities->values();
            $activitySlugs = $activities->pluck('slug', 'id')->all();

            return [
                'sourceId' => $node->id,
                'slug' => $node->slug,
                'title' => $node->title,
                'description' => $node->description,
                'position' => [
                    'q' => $node->position_q,
                    'r' => $node->position_r,
                ],
                'state' => $node->state,
                'visualConfig' => $node->visual_config ?? [],
                'activityGraphLayout' => $node->activity_graph_layout ?? [],
                'companionConfig' => $node->companion_config,
                'startActivitySlug' => $activitySlugs[$node->start_activity_id] ?? null,
                'activityStarts' => $node->activityStarts->map(fn (LearningActivityStart $start): array => [
                    'activitySlug' => $start->activity?->slug,
                    'label' => $start->label,
                    'description' => $start->description,
                    'imageDark' => $start->image_dark,
                    'imageLight' => $start->image_light,
                    'buttonColorDark' => $start->button_color_dark,
                    'buttonBorderColorDark' => $start->button_border_color_dark,
                    'buttonColorLight' => $start->button_color_light,
                    'buttonBorderColorLight' => $start->button_border_color_light,
                    'sortOrder' => $start->sort_order,
                ])->values()->all(),
                'activities' => $activities->map(function (LearningActivity $activity): array {
                    return [
                        'sourceId' => $activity->id,
                        'slug' => $activity->slug,
                        'type' => $activity->type,
                        'title' => $activity->title,
                        'introduction' => $activity->introduction,
                        'config' => $activity->config ?? [],
                        'sortOrder' => $activity->sort_order,
                        'graphPosition' => [
                            'x' => $activity->graph_position_x,
                            'y' => $activity->graph_position_y,
                        ],
                        'companionConfig' => $activity->companion_config,
                        'question' => $activity->question ? [
                            'prompt' => $activity->question->prompt,
                            'feedbackCorrect' => $activity->question->feedback_correct,
                            'feedbackIncorrect' => $activity->question->feedback_incorrect,
                            'explanation' => $activity->question->explanation,
                            'allowMultiple' => $activity->question->allow_multiple,
                            'options' => $activity->question->options->map(fn (LearningQuestionOption $option): array => [
                                'label' => $option->label,
                                'body' => $option->body,
                                'isCorrect' => $option->is_correct,
                                'outcomeKey' => $option->outcome_key,
                                'feedback' => $option->feedback,
                                'weights' => $option->weights ?? [],
                                'sortOrder' => $option->sort_order,
                            ])->values()->all(),
                        ] : null,
                        'dialogueNodes' => $activity->npcDialogueNodes->map(fn (NpcDialogueNode $dialogueNode): array => [
                            'sourceId' => $dialogueNode->id,
                            'type' => $dialogueNode->type,
                            'title' => $dialogueNode->title,
                            'body' => $dialogueNode->body,
                            'config' => $dialogueNode->config ?? [],
                            'sortOrder' => $dialogueNode->sort_order,
                            'graphPosition' => [
                                'x' => $dialogueNode->graph_position_x,
                                'y' => $dialogueNode->graph_position_y,
                            ],
                        ])->values()->all(),
                        'dialogueTransitions' => $activity->npcDialogueTransitions->map(fn (NpcDialogueTransition $transition): array => [
                            'fromSourceId' => $transition->from_dialogue_node_id,
                            'toSourceId' => $transition->to_dialogue_node_id,
                            'fromConnector' => $transition->from_connector,
                            'toConnector' => $transition->to_connector,
                        ])->values()->all(),
                        'translations' => $activity->translations->map(fn (LearningActivityTranslation $translation): array => [
                            'locale' => $translation->locale,
                            'content' => $translation->content,
                        ])->values()->all(),
                        'transitions' => $activity->transitions->map(fn (ActivityTransition $transition): array => [
                            'toActivitySlug' => $transition->toActivity?->slug,
                            'fromConnector' => $transition->from_connector,
                            'toConnector' => $transition->to_connector,
                            'trigger' => $transition->trigger,
                            'triggerValue' => $transition->trigger_value,
                            'label' => $transition->label,
                            'rules' => $transition->rules ?? [],
                        ])->values()->all(),
                    ];
                })->values()->all(),
            ];
        })->values()->all();

        $mapAssetExports = $map->assets->map(fn (LearningMapAsset $asset): array => [
            'sourceId' => $asset->id,
            'nodeSlug' => $nodeSlugs[$asset->learning_node_id] ?? null,
            'imageUrl' => $asset->image_url,
            'text' => $asset->text,
            'x' => $asset->position_x,
            'y' => $asset->position_y,
            'z' => $asset->position_z,
            'width' => $asset->width,
            'opacity' => $asset->opacity,
            'locked' => $asset->locked,
            'focusable' => $asset->focusable,
            'interactionMode' => $asset->interaction_mode
                ?? ($asset->focusable ? 'focusable' : 'decorative'),
            'interactionConfig' => $asset->interaction_config ?? [],
            'visualConfig' => $asset->visual_config ?? [],
            'soundConfig' => $asset->sound_config ?? [],
            'messageTopics' => $asset->messageTopics->map(fn (LearningMessageTopic $topic): array => [
                'sourceId' => $topic->id,
                'slug' => $topic->slug,
                'title' => $topic->title,
            ])->values()->all(),
        ])->values()->all();

        $mapExport = [
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'topicSlug' => $map->topic?->slug,
            'backgroundConfig' => $map->background_config ?? [],
            'gridConfig' => $map->grid_config ?? [],
            'accessRoles' => $map->access_roles ?? [],
            'timeBackgroundEnabled' => $map->time_background_enabled,
            'mapAssetsLocked' => $map->map_assets_locked,
            'companionConfig' => $map->companion_config,
        ];

        return [
            'format' => 'wicked-learning-map',
            'formatVersion' => 1,
            'exportedAt' => now()->toIso8601String(),
            'world' => [
                'slug' => $map->world?->slug,
                'title' => $map->world?->title,
            ],
            'map' => $mapExport,
            'nodes' => $nodeExports,
            'mapAssets' => $mapAssetExports,
            'portalTargets' => $portalTargets,
            'references' => [
                'mediaUrls' => $this->collectMediaUrls([
                    'map' => $mapExport,
                    'nodes' => $nodeExports,
                    'mapAssets' => $mapAssetExports,
                    'portalTargets' => $portalTargets,
                ]),
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadPortalTargets(LearningMap $map): array
    {
        return $this->serializePortalTargets(LearningPortalLink::query()
            ->with([
                'sourceActivity',
                'sourceNode',
                'targetActivity',
                'targetNode.map',
            ])
            ->whereHas('sourceNode', function (Builder $query) use ($map): void {
                $query->where('learning_map_id', $map->id);
            })
            ->orderBy('id')
            ->get());
    }

    /**
     * @param  Collection<int, LearningPortalLink>  $links
     * @return list<array<string, mixed>>
     */
    public function serializePortalTargets(Collection $links): array
    {
        return array_values($links->map(fn (LearningPortalLink $link): array => [
            'sourceNodeSlug' => $link->sourceNode?->slug,
            'sourceActivitySlug' => $link->sourceActivity?->slug,
            'targetMapSlug' => $link->targetNode?->map?->slug,
            'targetNodeSlug' => $link->targetNode?->slug,
            'targetActivitySlug' => $link->targetActivity?->slug,
            'label' => $link->label,
            'description' => $link->description,
            'config' => $link->config ?? [],
        ])
            ->all());
    }

    /**
     * @return list<string>
     */
    private function collectMediaUrls(mixed $value): array
    {
        $urls = [];

        if (! is_array($value)) {
            return [];
        }

        foreach ($value as $key => $nestedValue) {
            if (
                is_string($nestedValue)
                && $this->isMediaKey((string) $key)
                && trim($nestedValue) !== ''
            ) {
                $urls[] = $nestedValue;
            }

            if (is_array($nestedValue)) {
                $urls = array_merge($urls, $this->collectMediaUrls($nestedValue));
            }
        }

        return array_values(array_unique($urls));
    }

    private function isMediaKey(string $key): bool
    {
        $normalizedKey = strtolower(str_replace(['_', '-'], '', $key));

        return str_ends_with($normalizedKey, 'url')
            || str_contains($normalizedKey, 'image')
            || str_contains($normalizedKey, 'sound')
            || str_contains($normalizedKey, 'audio')
            || $normalizedKey === 'src';
    }
}
