<?php

namespace App\Learning\Services;

use App\Models\LearningNode;
use Illuminate\Support\Carbon;

class NodeAvailabilitySchedule
{
    public function isLockedBySchedule(LearningNode $node): bool
    {
        $lockAt = $this->timestamp($node, 'lockAt');

        return $lockAt !== null && Carbon::now()->greaterThanOrEqualTo($lockAt);
    }

    public function isUnlockedBySchedule(LearningNode $node): bool
    {
        $unlockAt = $this->timestamp($node, 'unlockAt');

        return $unlockAt !== null && Carbon::now()->greaterThanOrEqualTo($unlockAt);
    }

    public function hasUnlockSchedule(LearningNode $node): bool
    {
        return $this->timestamp($node, 'unlockAt') !== null;
    }

    private function timestamp(LearningNode $node, string $key): ?Carbon
    {
        $config = is_array($node->visual_config) ? $node->visual_config : [];
        $schedule = is_array($config['schedule'] ?? null) ? $config['schedule'] : [];
        $value = $schedule[$key] ?? null;

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
