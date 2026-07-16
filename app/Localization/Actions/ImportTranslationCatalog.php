<?php

namespace App\Localization\Actions;

use App\Localization\Services\ActivityTranslationPayloadFactory;
use App\Models\LearningActivity;
use App\Models\LearningActivityTranslation;
use App\Models\PlatformLanguage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImportTranslationCatalog
{
    public function __construct(private readonly ActivityTranslationPayloadFactory $activityPayloads) {}

    /**
     * @param  array<string, mixed>  $catalog
     */
    public function handle(PlatformLanguage $language, array $catalog, User $user): void
    {
        $this->validateCatalog($catalog, $language->code);

        DB::transaction(function () use ($catalog, $language, $user): void {
            $language->translations = $this->platformTranslations($catalog['platform']);
            $language->updated_by = $user->id;
            $language->save();

            foreach ($catalog['activities'] as $activityId => $content) {
                if (! is_numeric($activityId) || ! is_array($content)) {
                    continue;
                }

                $activity = LearningActivity::query()->find((int) $activityId);

                if (! $activity) {
                    continue;
                }

                LearningActivityTranslation::query()->updateOrCreate(
                    ['learning_activity_id' => $activity->id, 'locale' => $language->code],
                    ['content' => $this->filterActivityContent($activity, $content)],
                );
            }
        });
    }

    /**
     * @param  array<string, mixed>  $catalog
     */
    private function validateCatalog(array $catalog, string $locale): void
    {
        $meta = is_array($catalog['meta'] ?? null) ? $catalog['meta'] : [];

        if (($meta['format'] ?? null) !== 'learning-worlds.translation-catalog' || ($meta['locale'] ?? null) !== $locale) {
            throw ValidationException::withMessages([
                'catalog' => 'The translation file does not match the selected language.',
            ]);
        }

        if (! is_array($catalog['platform'] ?? null) || ! is_array($catalog['activities'] ?? null)) {
            throw ValidationException::withMessages([
                'catalog' => 'The translation file has an invalid structure.',
            ]);
        }
    }

    /**
     * @param  array<array-key, mixed>  $translations
     * @return array<string, string>
     */
    private function platformTranslations(array $translations): array
    {
        return collect($translations)
            ->filter(fn (mixed $value, mixed $key): bool => is_string($key) && is_string($value))
            ->map(fn (string $value): string => $value)
            ->all();
    }

    /**
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    private function filterActivityContent(LearningActivity $activity, array $content): array
    {
        $source = $this->activityPayloads->make($activity);

        return $this->mergeStringsWithinShape($source, $content);
    }

    /**
     * @param  array<string, mixed>  $shape
     * @param  array<string, mixed>  $candidate
     * @return array<string, mixed>
     */
    private function mergeStringsWithinShape(array $shape, array $candidate): array
    {
        $result = [];

        foreach ($shape as $key => $value) {
            $translated = $candidate[$key] ?? null;

            if (is_string($value) || $value === null) {
                $result[$key] = is_string($translated) ? $translated : $value;
            } elseif (is_array($value) && is_array($translated)) {
                $result[$key] = $this->mergeStringsWithinShape($value, $translated);
            } elseif (is_array($value)) {
                $result[$key] = $value;
            }
        }

        return $result;
    }
}
