<?php

namespace App\Learning\Services;

use App\Models\LearningNode;

class LearningNodeStateResolver
{
    public function __construct(
        private readonly LearnerNodeAnswerEventService $answerEvents,
        private readonly NodeAvailabilitySchedule $availabilitySchedule,
        private readonly NodeRevealService $nodeRevealService,
        private readonly NodeUnlockService $nodeUnlockService,
    ) {}

    public function stateForUser(LearningNode $node, ?int $userId): string
    {
        if ($this->answerEvents->isHiddenForUser($node, $userId)) {
            return 'hidden';
        }

        if ($this->nodeRevealService->isConcealedForUser($node, $userId)) {
            return 'hidden';
        }

        if ($this->availabilitySchedule->isLockedBySchedule($node)) {
            return 'locked';
        }

        if ($node->state === 'hidden' && $this->nodeRevealService->isDiscoverable($node)) {
            return 'available';
        }

        if ($node->state === 'locked' && $this->nodeUnlockService->isUnlockedForUser($node, $userId)) {
            return 'available';
        }

        return $node->state;
    }

    public function canPlay(LearningNode $node, ?int $userId): bool
    {
        return ! in_array($this->stateForUser($node, $userId), ['hidden', 'locked'], true);
    }
}
