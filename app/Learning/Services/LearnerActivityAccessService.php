<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\User;

/** Keeps learner mutations scoped to content they can currently play. */
class LearnerActivityAccessService
{
    public function __construct(
        private readonly ActiveLearningActivityResolver $activeActivity,
        private readonly LearningMapAccessService $mapAccess,
        private readonly LearningNodeStateResolver $nodeState,
    ) {}

    public function assertCanPlay(User $user, LearningActivity $activity): void
    {
        $activity->loadMissing('node.map');

        abort_unless(
            $activity->node !== null
                && $activity->node->map !== null
                && $this->mapAccess->canViewMap($activity->node->map, $user)
                && $this->nodeState->canPlay($activity->node, $user->id),
            404,
        );
    }

    public function assertActive(User $user, LearningActivity $activity, string $playRunId): void
    {
        $this->assertCanPlay($user, $activity);

        abort_unless($this->activeActivity->isActive($user, $activity, $playRunId), 404);
    }

    public function assertCanViewNode(User $user, LearningNode $node): void
    {
        $node->loadMissing('map');

        abort_unless(
            $node->map !== null && $this->mapAccess->canViewMap($node->map, $user),
            404,
        );
    }
}
