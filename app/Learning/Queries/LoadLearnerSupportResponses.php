<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearnerMessageResponse;
use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/** Loads a bounded set of private support replies for the current learner. */
class LoadLearnerSupportResponses
{
    private const MAX_RESPONSES = 12;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /** @return Collection<int, LearnerMessageResponse> */
    public function handle(User $user): Collection
    {
        return LearnerMessageResponse::query()
            ->select(['id', 'learner_message_id', 'body', 'created_at'])
            ->whereNull('hidden_at')
            ->whereHas('message', function (Builder $query) use ($user): void {
                $query
                    ->where('user_id', $user->id)
                    ->where('audience', 'support')
                    ->whereNull('hidden_at');
            })
            ->whereHas('message.topic.mapAsset.node.map', function (Builder $query) use ($user): void {
                $this->mapAccess->constrainVisibleQuery($query, $user);
            })
            ->with('message.topic.mapAsset.node.map')
            ->latest('created_at')
            ->latest('id')
            ->limit(self::MAX_RESPONSES)
            ->get()
            ->filter(function (LearnerMessageResponse $response) use ($user): bool {
                $map = $response->message?->topic?->mapAsset?->node?->map;

                return $map instanceof LearningMap
                    && $this->mapAccess->canViewMap($map, $user);
            })
            ->values();
    }
}
