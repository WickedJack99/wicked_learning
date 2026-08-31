<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class LoadWorldBuilderReviewQueue
{
    public const DEFAULT_PAGE_SIZE = 4;

    public const MAX_PAGE_SIZE = 12;

    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    /**
     * @return LengthAwarePaginator<int, LearningActivity>
     */
    public function paginate(
        User $user,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        $worldId = $this->worldResolver->query()->value('id');
        $editableMaps = LearningMap::query()
            ->where('learning_world_id', $worldId)
            ->select('learning_maps.id');
        $this->mapEditAccess->scopeEditableMaps($editableMaps, $user);

        return LearningActivity::query()
            ->select('learning_activities.*')
            ->join(
                'learning_nodes',
                'learning_nodes.id',
                '=',
                'learning_activities.learning_node_id',
            )
            ->join(
                'learning_maps',
                'learning_maps.id',
                '=',
                'learning_nodes.learning_map_id',
            )
            ->whereIn('learning_maps.id', $editableMaps)
            ->where(function (Builder $query): void {
                $query
                    ->whereNull('learning_activities.ai_review_status')
                    ->orWhere(
                        'learning_activities.ai_review_status',
                        '!=',
                        LearningActivity::AI_REVIEW_STATUS_REVIEWED,
                    );
            })
            ->with([
                'node:id,title,learning_map_id',
                'node.map:id,title',
            ])
            ->orderBy('learning_maps.id')
            ->orderBy('learning_nodes.position_q')
            ->orderBy('learning_nodes.position_r')
            ->orderBy('learning_activities.sort_order')
            ->orderBy('learning_activities.id')
            ->paginate(
                perPage: max(1, min(self::MAX_PAGE_SIZE, $perPage)),
                page: max(1, $page),
            );
    }
}
