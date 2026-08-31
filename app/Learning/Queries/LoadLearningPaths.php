<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Learning\Services\ActivityRouteEligibility;
use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\LearningNodeStateResolver;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivityStart;
use App\Models\LearningTopic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class LoadLearningPaths
{
    private const int PAGE_SIZE = 6;

    private const int SCAN_CHUNK_SIZE = 100;

    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly ActivityRouteEligibility $routeEligibility,
        private readonly ActivityCompetenceConfiguration $activityCompetence,
        private readonly LearningMapAccessService $mapAccess,
        private readonly LearningNodeStateResolver $nodeStateResolver,
    ) {}

    /**
     * @return array{
     *     routes: Collection<int, LearningActivityStart>,
     *     progress: array<string, LearnerRouteProgress>,
     *     pagination: array{currentPage: int, lastPage: int, perPage: int, total: int},
     *     purpose: ?string
     * }
     */
    public function handle(User $user, ?LearningTopic $topic = null, int $page = 1, ?string $purpose = null): array
    {
        $page = max(1, $page);
        $worldId = $this->worldResolver->query()->value('id');

        if (! $worldId) {
            return [
                'routes' => collect(),
                'progress' => [],
                'pagination' => [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => self::PAGE_SIZE,
                    'total' => 0,
                ],
                'purpose' => $purpose,
            ];
        }

        $scan = $this->scanRoutes($user, $topic, $worldId, $page, $purpose);
        $lastPage = max(1, (int) ceil($scan['total'] / self::PAGE_SIZE));

        if ($page > $lastPage && $scan['total'] > 0) {
            $page = $lastPage;
            $scan = $this->scanRoutes($user, $topic, $worldId, $page, $purpose);
        }

        $routes = $scan['routes'];

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
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => $lastPage,
                'perPage' => self::PAGE_SIZE,
                'total' => $scan['total'],
            ],
            'purpose' => $purpose,
        ];
    }

    /**
     * Scan candidates in bounded chunks so route availability keeps using the
     * existing per-learner state services without hydrating the whole catalog.
     *
     * @return array{routes: Collection<int, LearningActivityStart>, total: int}
     */
    private function scanRoutes(User $user, ?LearningTopic $topic, int $worldId, int $page, ?string $purpose): array
    {
        $routes = collect();
        $total = 0;
        $firstMatch = ($page - 1) * self::PAGE_SIZE;

        $this->routeQuery($topic, $worldId)->chunk(self::SCAN_CHUNK_SIZE, function (Collection $candidates) use ($user, $purpose, &$routes, &$total, $firstMatch): void {
            foreach ($candidates as $route) {
                if (! $this->isVisibleRoute($route, $user)) {
                    continue;
                }

                if ($purpose !== null && $this->activityCompetence->learningIntentForActivity($route->activity) !== $purpose) {
                    continue;
                }

                if ($total >= $firstMatch && $routes->count() < self::PAGE_SIZE) {
                    $routes->push($route);
                }

                $total++;
            }
        });

        return [
            'routes' => $routes,
            'total' => $total,
        ];
    }

    /**
     * @return Builder<LearningActivityStart>
     */
    private function routeQuery(?LearningTopic $topic, int $worldId): Builder
    {
        return LearningActivityStart::query()
            ->with([
                'activity',
                'node.discoveries',
                'node.map.topic.area',
                'node.mapAsset',
            ])
            ->whereHas('node.map', function ($query) use ($topic, $worldId): void {
                $query->where('learning_world_id', $worldId)
                    ->when($topic !== null, fn ($mapQuery) => $mapQuery->where('learning_topic_id', $topic->id));
            })
            ->orderBy('learning_node_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    private function isVisibleRoute(LearningActivityStart $route, User $user): bool
    {
        return $route->node !== null
            && $route->node->map !== null
            && $route->activity !== null
            && $this->mapAccess->canViewMap($route->node->map, $user)
            && $this->nodeStateResolver->canPlay($route->node, $user->id)
            && ($route->node->visual_config['hideEmptySpace'] ?? false) !== true
            && $this->routeEligibility->canStart($route->activity);
    }

    private function progressKey(int $nodeId, ?int $activityId): string
    {
        return $nodeId.':'.($activityId ?? 0);
    }
}
