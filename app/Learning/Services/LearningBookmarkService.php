<?php

namespace App\Learning\Services;

use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class LearningBookmarkService
{
    public function __construct(
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    public function bookmark(int $userId, LearningNode $node): void
    {
        if (! $this->isVisibleNode($node)) {
            abort(404);
        }

        LearningNodeBookmark::query()->firstOrCreate([
            'user_id' => $userId,
            'learning_node_id' => $node->id,
        ]);
    }

    public function unbookmark(int $userId, LearningNode $node): void
    {
        LearningNodeBookmark::query()
            ->where('user_id', $userId)
            ->where('learning_node_id', $node->id)
            ->delete();
    }

    /**
     * @return array<int, int>
     */
    public function bookmarkedNodeIds(User $user): array
    {
        $query = LearningNodeBookmark::query()
            ->where('user_id', $user->id);

        $this->constrainVisibleBookmarkQuery($query, $user);

        return $query
            ->pluck('learning_node_id')
            ->map(fn (int $nodeId): int => $nodeId)
            ->all();
    }

    public function isBookmarked(int $userId, LearningNode $node): bool
    {
        return LearningNodeBookmark::query()
            ->where('user_id', $userId)
            ->where('learning_node_id', $node->id)
            ->exists();
    }

    public function isVisibleNode(LearningNode $node): bool
    {
        if ($node->state === 'hidden') {
            return false;
        }

        return ($node->visual_config['hideEmptySpace'] ?? false) !== true;
    }

    /**
     * @param  Builder<LearningNodeBookmark>  $query
     */
    public function constrainVisibleBookmarkQuery(Builder $query, User $user): void
    {
        $query
            ->whereHas('node', function (Builder $query): void {
                $query
                    ->where('state', '!=', 'hidden')
                    ->where(function (Builder $query): void {
                        $query
                            ->whereNull('visual_config')
                            ->orWhereJsonDoesntContain('visual_config->hideEmptySpace', true);
                    });
            })
            ->whereHas('node.map', function (Builder $query) use ($user): void {
                $this->mapAccess->constrainVisibleQuery($query, $user);
            });
    }
}
