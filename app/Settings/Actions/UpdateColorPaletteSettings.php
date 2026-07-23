<?php

namespace App\Settings\Actions;

use App\Access\PermissionCatalog;
use App\Learning\Actions\UpdateLearningMapVisuals;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Services\JournalThemeConfiguration;
use App\Models\LearningMap;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformPresentationSetting;
use App\Models\User;

class UpdateColorPaletteSettings
{
    public function __construct(
        private readonly JournalThemeConfiguration $journalTheme,
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly UpdateLearningMapVisuals $updateMapVisuals,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, array $data): void
    {
        if ($this->canUpdate($user, 'presentation') && isset($data['publicPresentation']) && is_array($data['publicPresentation'])) {
            PlatformPresentationSetting::updateCurrent($data['publicPresentation'], $user);
        }

        if ($this->canUpdate($user, PermissionCatalog::JOURNAL_SETTINGS) && isset($data['journalTheme']) && is_array($data['journalTheme'])) {
            PlatformJournalSetting::current()
                ->forceFill([
                    'theme' => $this->journalTheme->normalize($data['journalTheme']),
                    'updated_by_user_id' => $user->id,
                ])
                ->save();
        }

        if ($this->canUpdate($user, PermissionCatalog::WORLD_MAPS) && isset($data['mapBackgroundConfigs']) && is_array($data['mapBackgroundConfigs'])) {
            $this->updateMaps($user, $data['mapBackgroundConfigs']);
        }
    }

    private function canUpdate(User $user, string $resource): bool
    {
        return $user->can("{$resource}.ru") || $user->can("{$resource}.rud");
    }

    /**
     * @param  array<int, mixed>  $mapConfigs
     */
    private function updateMaps(User $user, array $mapConfigs): void
    {
        $maps = $this->loadEditableWorldGraph
            ->handle($user)
            ->maps
            ->keyBy('id');

        foreach ($mapConfigs as $mapConfig) {
            if (! is_array($mapConfig)) {
                continue;
            }

            $map = $maps->get((int) ($mapConfig['id'] ?? 0));
            $backgroundConfig = $mapConfig['backgroundConfig'] ?? null;

            if (! $map instanceof LearningMap || ! is_array($backgroundConfig)) {
                continue;
            }

            $this->updateMapVisuals->handle($map, [
                'background_config' => $backgroundConfig,
            ]);
        }
    }
}
