<?php

namespace App\Learning\Services;

use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Support\Collection;

class LearnerMapLocationService
{
    private const SETTINGS_KEY = 'learning';

    private const LAST_MAP_ID_KEY = 'lastMapId';

    private const LAST_MAP_SLUG_KEY = 'lastMapSlug';

    /**
     * @param  Collection<int, LearningMap>  $visibleMaps
     */
    public function mapFromRequest(?string $mapReference, Collection $visibleMaps): ?LearningMap
    {
        if ($mapReference === null || trim($mapReference) === '') {
            return null;
        }

        return $visibleMaps
            ->first(fn (LearningMap $map): bool => $map->slug === $mapReference
                || (is_numeric($mapReference) && $map->id === (int) $mapReference));
    }

    /**
     * @param  Collection<int, LearningMap>  $visibleMaps
     */
    public function preferredMap(User $user, Collection $visibleMaps): ?LearningMap
    {
        $settings = $this->learningSettings($user);
        $lastMapId = $settings[self::LAST_MAP_ID_KEY] ?? null;
        $lastMapSlug = $settings[self::LAST_MAP_SLUG_KEY] ?? null;

        return $visibleMaps->first(
            fn (LearningMap $map): bool => ($lastMapId !== null && $map->id === (int) $lastMapId)
                || (is_string($lastMapSlug) && $map->slug === $lastMapSlug),
        );
    }

    public function record(User $user, LearningMap $map): void
    {
        $preference = $user->preference()->firstOrNew(['user_id' => $user->id]);
        $settings = is_array($preference->settings) ? $preference->settings : [];
        $learningSettings = is_array($settings[self::SETTINGS_KEY] ?? null)
            ? $settings[self::SETTINGS_KEY]
            : [];

        $learningSettings[self::LAST_MAP_ID_KEY] = $map->id;
        $learningSettings[self::LAST_MAP_SLUG_KEY] = $map->slug;
        $settings[self::SETTINGS_KEY] = $learningSettings;

        $preference->settings = $settings;
        $preference->save();
    }

    /**
     * @return array<string, mixed>
     */
    private function learningSettings(User $user): array
    {
        $settings = $user->preference?->settings;

        if (! is_array($settings)) {
            return [];
        }

        $learningSettings = $settings[self::SETTINGS_KEY] ?? [];

        return is_array($learningSettings) ? $learningSettings : [];
    }
}
