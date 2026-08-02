<?php

use App\Learning\Services\JournalThemeConfiguration;

test('journal background framing is normalized for both appearance modes', function () {
    $theme = app(JournalThemeConfiguration::class)->normalize([
        'dark' => [
            'backgroundImage' => '/images/themes/journal-half-open-book-dark.png',
            'backgroundPositionX' => 24,
            'backgroundPositionY' => 65,
            'backgroundZoom' => 145,
            'backgroundAssets' => [
                [
                    'id' => 'corner-ornament',
                    'image' => '/images/themes/corner-ornament.png',
                    'positionX' => 92,
                    'positionY' => 8,
                    'zoom' => 35,
                ],
            ],
        ],
        'light' => [
            'backgroundPositionX' => -10,
            'backgroundPositionY' => 110,
            'backgroundZoom' => 10,
        ],
    ]);

    expect($theme['dark'])
        ->toMatchArray([
            'backgroundImage' => '/images/themes/journal-half-open-book-dark.png',
            'backgroundPositionX' => 24,
            'backgroundPositionY' => 65,
            'backgroundZoom' => 145,
            'backgroundAssets' => [
                [
                    'id' => 'corner-ornament',
                    'image' => '/images/themes/corner-ornament.png',
                    'positionX' => 92,
                    'positionY' => 8,
                    'zoom' => 35,
                ],
            ],
        ])
        ->and($theme['light'])
        ->toMatchArray([
            'backgroundPositionX' => 0,
            'backgroundPositionY' => 100,
            'backgroundZoom' => 25,
        ]);
});
