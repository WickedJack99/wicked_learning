<?php

namespace App\Learning\Actions;

use App\Learning\Services\ItemGrantActivityConfiguration;
use App\Learning\Services\ItemObstacleActivityConfiguration;
use App\Learning\Services\MarkdownActivityConfiguration;
use App\Learning\Services\NpcDialogueConfiguration;
use App\Learning\Services\ObstacleActivityConfiguration;
use App\Learning\Services\PortalActivityConfiguration;
use App\Learning\Services\PortalLinkService;
use App\Learning\Services\ReflectionActivityConfiguration;
use App\Learning\Services\SharedTaskActivityConfiguration;
use App\Learning\Services\ToolGrantActivityConfiguration;
use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningActivity;
use App\Models\LearningNode;

class CreateLearningActivity
{
    public function __construct(
        private readonly PortalActivityConfiguration $portalConfig,
        private readonly MarkdownActivityConfiguration $markdownConfig,
        private readonly ItemGrantActivityConfiguration $itemGrantConfig,
        private readonly ItemObstacleActivityConfiguration $itemObstacleConfig,
        private readonly ObstacleActivityConfiguration $obstacleConfig,
        private readonly ToolGrantActivityConfiguration $toolGrantConfig,
        private readonly NpcDialogueConfiguration $npcDialogueConfig,
        private readonly ReflectionActivityConfiguration $reflectionConfig,
        private readonly SharedTaskActivityConfiguration $sharedTaskConfig,
        private readonly PortalLinkService $portalLinkService,
        private readonly UniqueSlugGenerator $slugGenerator,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningNode $node, array $data): LearningActivity
    {
        $type = (string) $data['type'];
        $activity = LearningActivity::query()->create([
            'learning_node_id' => $node->id,
            'slug' => ($data['slug'] ?? null) ?: $this->slugGenerator->forActivity($node, (string) $data['title']),
            'type' => $type,
            'title' => $data['title'],
            'introduction' => $data['introduction'] ?? null,
            'config' => $this->configFor($type, $data),
            'sort_order' => $this->nextSortOrder($node),
            'graph_position_x' => $data['graph_position_x'] ?? null,
            'graph_position_y' => $data['graph_position_y'] ?? null,
        ]);

        $this->portalLinkService->syncForActivity($activity, $data['target_portal_activity_id'] ?? null);
        $this->npcDialogueConfig->scaffoldDefaultEnd($activity);

        return $activity;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function configFor(string $type, array $data): array
    {
        return match ($type) {
            'item_grant' => $this->itemGrantConfig->fromData($data),
            'item_obstacle' => $this->itemObstacleConfig->fromData($data),
            'markdown' => $this->markdownConfig->fromData($data),
            'obstacle' => $this->obstacleConfig->fromData($data),
            'portal' => $this->portalConfig->fromData($data),
            'reflection' => $this->reflectionConfig->fromData($data),
            'shared_task' => $this->sharedTaskConfig->fromData($data),
            'tool_grant' => $this->toolGrantConfig->fromData($data),
            default => [],
        };
    }

    private function nextSortOrder(LearningNode $node): int
    {
        return ((int) LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->max('sort_order')) + 10;
    }
}
