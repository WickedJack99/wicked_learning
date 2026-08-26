<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\LearningNodeStateResolver;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivityStart;
use App\Models\User;
use Illuminate\Support\Collection;

class LoadLearningPaths
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly LearningMapAccessService $mapAccess,
        private readonly LearningNodeStateResolver $nodeStateResolver,
    ) {}

    /**
     * @return array{
     *     routes: Collection<int, LearningActivityStart>,
     *     progress: array<string, LearnerRouteProgress>
     * }
     */
    public function handle(User $user): array
    {
        $worldId = $this->worldResolver->query()->value('id');

        if (! $worldId) {
            return [
                'routes' => collect(),
                'progress' => [],
            ];
        }

        $routes = LearningActivityStart::query()
            ->with([
                'activity',
                'node.map.topic.area',
                'node.mapAsset',
            ])
            ->whereHas('node.map', fn ($query) => $query->where('learning_world_id', $worldId))
            ->orderBy('learning_node_id')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->filter(fn (LearningActivityStart $route): bool => $route->node !== null
                && $route->node->map !== null
                && $route->activity !== null
                && $this->mapAccess->canViewMap($route->node->map, $user)
                && $this->nodeStateResolver->canPlay($route->node, $user->id)
                && ($route->node->visual_config['hideEmptySpace'] ?? false) !== true
                && $this->routeEligibility->canStart($route->activity))
            ->values();

        $progress = LearnerRouteProgress::query()
            ->with('currentActivity')
            ->where('user_id', $user->id)
            ->whereIn('learning_node_id', $routes->pluck('learning_node_id')->all())
            ->get()
            ->keyBy(fn (LearnerRouteProgress $item): string => $this->progressKey(
                $item->learning_node_id,
                $item->start_learning_activity_id,
            ))
            ->all();

        return [
            'routes' => $routes,
            'progress' => $progress,
        ];
    }

    private function progressKey(int $nodeId, ?int $activityId): string
    {
        return $nodeId.':'.($activityId ?? 0);
    }
}
