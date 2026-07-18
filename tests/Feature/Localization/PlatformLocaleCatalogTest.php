<?php

use App\Localization\Services\PlatformLocaleCatalog;

test('english platform catalog includes generic settings copy', function () {
    $translations = app(PlatformLocaleCatalog::class)->englishTranslations();

    foreach ([
        'settings.title',
        'settings.navigation.personal',
        'settings.navigation.languages.description',
        'settings.access.title',
        'settings.access.users.create_token',
        'settings.access.roles.permission_level',
        'settings.personal.profile.title',
        'settings.personal.profile.image.upload_error',
        'settings.personal.security.save',
        'settings.administration.languages.head_title',
        'settings.administration.languages.download_english',
        'navigation.bottom.map',
        'navigation.bottom.return_to_activity',
        'settings.assets.title',
        'settings.assets.sections.tools.description',
        'settings.assets.planned',
    ] as $key) {
        expect($translations)->toHaveKey($key);
        expect($translations[$key])->not->toBe('');
    }
});

test('english platform catalog keeps exported values flat strings', function () {
    $translations = app(PlatformLocaleCatalog::class)->englishTranslations();

    expect($translations)->not->toBeEmpty();

    foreach ($translations as $key => $value) {
        expect($key)->toBeString();
        expect($value)->toBeString();
    }
});
