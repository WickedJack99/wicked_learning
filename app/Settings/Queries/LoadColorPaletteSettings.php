<?php

namespace App\Settings\Queries;

use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\LearningMap;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformPresentationSetting;
use App\Models\User;

class LoadColorPaletteSettings
{
    public function __construct(
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly PlatformJournalSettingsSerializer $journalSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(User $user): array
    {
        $canReadPresentation = $user->can('presentation.ro') || $user->can('presentation.ru') || $user->can('presentation.rud');
        $canReadJournals = $user->can('journal_settings.ro') || $user->can('journal_settings.ru') || $user->can('journal_settings.rud');
        $canReadWorlds = $user->can('world_maps.ro') || $user->can('world_maps.ru') || $user->can('world_maps.rud');

        abort_unless($canReadPresentation || $canReadJournals || $canReadWorlds, 403);

        return [
            'canUpdate' => [
                'journal' => $user->can('journal_settings.ru') || $user->can('journal_settings.rud'),
                'maps' => $user->can('world_maps.ru') || $user->can('world_maps.rud'),
                'presentation' => $user->can('presentation.ru') || $user->can('presentation.rud'),
            ],
            'journal' => $canReadJournals
                ? $this->journalSerializer->serialize(PlatformJournalSetting::current())
                : null,
            'maps' => $canReadWorlds ? $this->maps($user) : [],
            'publicPresentation' => $canReadPresentation
                ? PlatformPresentationSetting::current()
                : null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function maps(User $user): array
    {
        return $this->loadEditableWorldGraph
            ->handle($user)
            ->maps
            ->sortBy('title')
            ->values()
            ->map(fn (LearningMap $map): array => [
                'backgroundConfig' => $map->background_config ?? [],
                'id' => $map->id,
                'slug' => $map->slug,
                'title' => $map->title,
            ])
            ->all();
    }
}
