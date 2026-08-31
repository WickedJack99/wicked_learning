<?php

namespace App\Localization\Services;

use App\Models\PlatformLanguage;
use Illuminate\Support\Facades\Cache;

class PlatformLocaleCatalog
{
    public const DEFAULT_LOCALE = 'en';

    /**
     * @var array<string, array<string, string>>
     */
    private array $translationCache = [];

    /**
     * @var array<string, string>|null
     */
    private ?array $englishTranslationsCache = null;

    /**
     * @var list<array{code: string, name: string, nativeName: string}>|null
     */
    private ?array $availableLanguagesCache = null;

    /**
     * @return array<string, string>
     */
    public function translations(string $locale): array
    {
        if ($locale === self::DEFAULT_LOCALE) {
            return $this->englishTranslations();
        }

        if (array_key_exists($locale, $this->translationCache)) {
            return $this->translationCache[$locale];
        }

        return $this->translationCache[$locale] = Cache::remember(
            $this->cacheKey($locale),
            now()->addHours(12),
            function () use ($locale): array {
                $translations = PlatformLanguage::query()
                    ->where('code', $locale)
                    ->where('is_enabled', true)
                    ->value('translations');

                return is_array($translations) ? $this->stringValues($translations) : [];
            },
        );
    }

    /**
     * @return list<array{code: string, name: string, nativeName: string}>
     */
    public function available(): array
    {
        if ($this->availableLanguagesCache !== null) {
            return $this->availableLanguagesCache;
        }

        $default = [[
            'code' => self::DEFAULT_LOCALE,
            'name' => 'English',
            'nativeName' => 'English',
        ]];

        $configured = PlatformLanguage::query()
            ->where('is_enabled', true)
            ->where('code', '!=', self::DEFAULT_LOCALE)
            ->orderBy('name')
            ->get(['code', 'name', 'native_name'])
            ->map(fn (PlatformLanguage $language): array => [
                'code' => $language->code,
                'name' => $language->name,
                'nativeName' => $language->native_name,
            ])
            ->all();

        return $this->availableLanguagesCache = [...$default, ...$configured];
    }

    public function isAvailable(string $locale): bool
    {
        return collect($this->available())->contains(
            fn (array $language): bool => $language['code'] === $locale,
        );
    }

    /**
     * @return array<string, string>
     */
    public function englishTranslations(): array
    {
        if ($this->englishTranslationsCache !== null) {
            return $this->englishTranslationsCache;
        }

        $translations = [];

        foreach ($this->englishSourcePaths() as $path) {
            $decoded = json_decode((string) file_get_contents($path), true);

            if (is_array($decoded)) {
                $translations = [
                    ...$translations,
                    ...$this->stringValues($decoded),
                ];
            }
        }

        return $this->englishTranslationsCache = $translations;
    }

    public function forget(string $locale): void
    {
        Cache::forget($this->cacheKey($locale));
        unset($this->translationCache[$locale]);
        $this->availableLanguagesCache = null;
    }

    /**
     * @return list<string>
     */
    private function englishSourcePaths(): array
    {
        $paths = glob(lang_path('en/*.json')) ?: [];
        sort($paths);

        return $paths;
    }

    private function cacheKey(string $locale): string
    {
        return "platform-locale.catalog.{$locale}";
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @return array<string, string>
     */
    private function stringValues(array $values): array
    {
        return collect($values)
            ->filter(fn (mixed $value, mixed $key): bool => is_string($key) && is_string($value))
            ->map(fn (string $value): string => $value)
            ->all();
    }
}
