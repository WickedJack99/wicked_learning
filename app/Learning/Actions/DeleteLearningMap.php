<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\UserPreference;
use Illuminate\Support\Facades\DB;

class DeleteLearningMap
{
    public function __construct(private readonly DeleteLearningNode $deleteLearningNode) {}

    public function handle(LearningMap $map): void
    {
        DB::transaction(function () use ($map): void {
            $map->nodes()
                ->orderBy('id')
                ->get()
                ->each(fn ($node) => $this->deleteLearningNode->handle($node));

            $this->removeStoredMapLocations($map);
            $map->delete();
        });
    }

    private function removeStoredMapLocations(LearningMap $map): void
    {
        UserPreference::query()
            ->whereNotNull('settings')
            ->each(function (UserPreference $preference) use ($map): void {
                $settings = is_array($preference->settings) ? $preference->settings : [];
                $learningSettings = is_array($settings['learning'] ?? null) ? $settings['learning'] : [];

                if (! $this->referencesMap($learningSettings, $map)) {
                    return;
                }

                unset($learningSettings['lastMapId'], $learningSettings['lastMapSlug']);

                if ($learningSettings === []) {
                    unset($settings['learning']);
                } else {
                    $settings['learning'] = $learningSettings;
                }

                $preference->forceFill(['settings' => $settings])->save();
            });
    }

    /**
     * @param  array<string, mixed>  $learningSettings
     */
    private function referencesMap(array $learningSettings, LearningMap $map): bool
    {
        return (isset($learningSettings['lastMapId']) && (int) $learningSettings['lastMapId'] === $map->id)
            || (isset($learningSettings['lastMapSlug']) && (string) $learningSettings['lastMapSlug'] === $map->slug);
    }
}
