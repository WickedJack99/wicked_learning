<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

class ActivityRouteEligibility
{
    public function canStart(?LearningActivity $activity): bool
    {
        if (! $activity) {
            return false;
        }

        $config = is_array($activity->config) ? $activity->config : [];

        return $activity->type !== 'portal' || ($config['portalMode'] ?? 'output') !== 'input';
    }
}
