<?php

namespace App\Localization\Services;

use App\Models\LearningActivity;
use App\Models\PlatformLanguage;

class TranslationCatalogExportService
{
    public function __construct(
        private readonly ActivityTranslationPayloadFactory $activityPayloads,
        private readonly PlatformLocaleCatalog $platformCatalog,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function english(): array
    {
        return [
            'meta' => [
                'format' => 'learning-worlds.translation-catalog',
                'version' => 1,
                'locale' => PlatformLocaleCatalog::DEFAULT_LOCALE,
            ],
            'platform' => $this->platformCatalog->englishTranslations(),
            'activities' => $this->activityPayloads(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forLanguage(PlatformLanguage $language): array
    {
        return [
            'meta' => [
                'format' => 'learning-worlds.translation-catalog',
                'version' => 1,
                'locale' => $language->code,
            ],
            'platform' => $language->translations ?? [],
            'activities' => LearningActivity::query()
                ->with(['translations' => fn ($query) => $query->where('locale', $language->code)])
                ->get()
                ->mapWithKeys(fn (LearningActivity $activity): array => [
                    (string) $activity->id => $activity->translations->first()?->content ?? [],
                ])
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function activityPayloads(): array
    {
        return LearningActivity::query()
            ->with(['dialogueStages', 'npcDialogueNodes', 'question.options', 'transitions'])
            ->get()
            ->mapWithKeys(fn (LearningActivity $activity): array => [
                (string) $activity->id => $this->activityPayloads->make($activity),
            ])
            ->all();
    }
}
