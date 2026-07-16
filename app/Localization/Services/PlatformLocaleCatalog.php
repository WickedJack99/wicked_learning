<?php

namespace App\Localization\Services;

use App\Models\PlatformLanguage;

class PlatformLocaleCatalog
{
    public const DEFAULT_LOCALE = 'en';

    /**
     * @return array<string, string>
     */
    public function translations(string $locale): array
    {
        if ($locale === self::DEFAULT_LOCALE) {
            return $this->englishTranslations();
        }

        $translations = PlatformLanguage::query()
            ->where('code', $locale)
            ->where('is_enabled', true)
            ->value('translations');

        return is_array($translations) ? $this->stringValues($translations) : [];
    }

    /**
     * @return list<array{code: string, name: string, nativeName: string}>
     */
    public function available(): array
    {
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

        return [...$default, ...$configured];
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
        $path = lang_path('en.json');

        if (! is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $this->stringValues($decoded) : [];
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
