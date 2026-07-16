<?php

namespace App\Localization\Queries;

use App\Localization\Services\PlatformLocaleCatalog;
use App\Localization\Services\UserLocaleResolver;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningActivityTranslation;
use App\Models\User;

/**
 * Loads alternate learner copy only after the server proves that the activity
 * is the learner's current step in their active play run.
 */
class LoadActiveActivityTranslation
{
    public function __construct(private readonly UserLocaleResolver $localeResolver) {}

    /**
     * @return array<string, mixed>|null
     */
    public function handle(User $user, LearningActivity $activity, string $playRunId): ?array
    {
        $locale = $this->localeResolver->forUser($user);

        if ($locale === PlatformLocaleCatalog::DEFAULT_LOCALE || ! $this->isActive($user, $activity, $playRunId)) {
            return null;
        }

        $content = LearningActivityTranslation::query()
            ->where('learning_activity_id', $activity->id)
            ->where('locale', $locale)
            ->value('content');

        return is_array($content) ? $content : null;
    }

    private function isActive(User $user, LearningActivity $activity, string $playRunId): bool
    {
        return LearnerRouteProgress::query()
            ->where('user_id', $user->id)
            ->where('learning_node_id', $activity->learning_node_id)
            ->where('current_learning_activity_id', $activity->id)
            ->where('current_play_run_id', $playRunId)
            ->exists();
    }
}
