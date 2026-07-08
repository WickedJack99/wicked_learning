<?php

namespace App\Learning\Services;

use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;

class LearningBookmarkService
{
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
    public function bookmarkedNodeIds(int $userId): array
    {
        return LearningNodeBookmark::query()
            ->where('user_id', $userId)
            ->pluck('learning_node_id')
            ->map(fn (int $nodeId): int => $nodeId)
            ->all();
    }

    public function isVisibleNode(LearningNode $node): bool
    {
        if ($node->state === 'hidden') {
            return false;
        }

        return ($node->visual_config['hideEmptySpace'] ?? false) !== true;
    }
}
