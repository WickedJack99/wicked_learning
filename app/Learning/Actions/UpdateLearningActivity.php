<?php

namespace App\Learning\Actions;

use App\Learning\Services\ItemGrantActivityConfiguration;
use App\Learning\Services\ItemObstacleActivityConfiguration;
use App\Learning\Services\MarkdownActivityConfiguration;
use App\Learning\Services\NpcDialogueConfiguration;
use App\Learning\Services\ObstacleActivityConfiguration;
use App\Learning\Services\PortalActivityConfiguration;
use App\Learning\Services\PortalLinkService;
use App\Learning\Services\ToolGrantActivityConfiguration;
use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningActivity;

class UpdateLearningActivity
{
    public function __construct(
        private readonly NpcDialogueConfiguration $npcDialogueConfig,
        private readonly MarkdownActivityConfiguration $markdownConfig,
        private readonly ItemGrantActivityConfiguration $itemGrantConfig,
        private readonly ItemObstacleActivityConfiguration $itemObstacleConfig,
        private readonly ObstacleActivityConfiguration $obstacleConfig,
        private readonly ToolGrantActivityConfiguration $toolGrantConfig,
        private readonly PortalActivityConfiguration $portalConfig,
        private readonly PortalLinkService $portalLinkService,
        private readonly UniqueSlugGenerator $slugGenerator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningActivity $activity, array $data): LearningActivity
    {
        $activity->loadMissing('node');
        $updates = $this->updatesFor($activity, $data);
        $activity->forceFill($updates)->save();
        $this->npcDialogueConfig->scaffoldDefaultEnd($activity);
        $this->syncPortalLinkWhenNeeded($activity, $data);

        return $activity;
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
            || $this->itemGrantConfig->shouldUpdate($data, $updates)
            || $this->itemObstacleConfig->shouldUpdate($data, $updates)
            || $this->obstacleConfig->shouldUpdate($data, $updates)
            || $this->toolGrantConfig->shouldUpdate($data, $updates)
        ) {
            $config = is_array($activity->config) ? $activity->config : [];
            $updates['config'] = $this->configFor($type, $data, $config);
        }

        return $updates;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    private function configFor(string $type, array $data, array $existing): array
    {
        return match ($type) {
            'item_grant' => $this->itemGrantConfig->fromData($data, $existing),
            'item_obstacle' => $this->itemObstacleConfig->fromData($data, $existing),
            'markdown' => $this->markdownConfig->fromData($data, $existing),
            'obstacle' => $this->obstacleConfig->fromData($data, $existing),
            'portal' => $this->portalConfig->fromData($data, $existing),
            'tool_grant' => $this->toolGrantConfig->fromData($data, $existing),
            default => [],
        };
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
