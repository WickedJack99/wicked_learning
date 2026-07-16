<?php

namespace App\Localization\Queries;

use App\Localization\Services\PlatformLocaleCatalog;
use App\Models\PlatformLanguage;

class LoadLanguageAdministration
{
    /**
     * @return list<array{code: string, name: string, nativeName: string, isEnabled: bool, isDefault: bool}>
     */
    public function handle(): array
    {
        $english = [[
            'code' => PlatformLocaleCatalog::DEFAULT_LOCALE,
            'name' => 'English',
            'nativeName' => 'English',
            'isEnabled' => true,
            'isDefault' => true,
        ]];

        $configured = PlatformLanguage::query()
            ->orderBy('name')
            ->get()
            ->map(fn (PlatformLanguage $language): array => [
                'code' => $language->code,
                'name' => $language->name,
                'nativeName' => $language->native_name,
                'isEnabled' => $language->is_enabled,
                'isDefault' => false,
            ])
            ->all();

        return [...$english, ...$configured];
    }
}
