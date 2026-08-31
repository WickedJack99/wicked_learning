<?php

namespace App\Learning\Serializers;

use App\Models\ActivityTransition;
use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use Illuminate\Database\Eloquent\Builder;

class LearningMapExportSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningMap $map): array
    {
        $map->loadMissing([
            'world',
            'topic',
            'nodes.activities.transitions.toActivity',
            'nodes.activityStarts.activity',
            'assets',
        ]);

        $nodes = $map->nodes->sortBy('id')->values();
        $nodeSlugs = $nodes->pluck('slug', 'id')->all();
        $portalTargets = $this->loadPortalTargets($map);

        $nodeExports = $nodes->map(function (LearningNode $node): array {
            $activities = $node->activities->values();
            $activitySlugs = $activities->pluck('slug', 'id')->all();

            return [
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
        return LearningPortalLink::query()
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
            ->get()
            ->map(fn (LearningPortalLink $link): array => [
                'sourceNodeSlug' => $link->sourceNode?->slug,
                'sourceActivitySlug' => $link->sourceActivity?->slug,
                'targetMapSlug' => $link->targetNode?->map?->slug,
                'targetNodeSlug' => $link->targetNode?->slug,
                'targetActivitySlug' => $link->targetActivity?->slug,
                'label' => $link->label,
                'description' => $link->description,
                'config' => $link->config ?? [],
            ])
            ->values()
            ->all();
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
