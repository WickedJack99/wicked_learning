<?php

use App\Learning\Services\CompetenceVisualScale;

test('visual scale separates established size from current glow', function () {
    $visual = app(CompetenceVisualScale::class)->forTopic(
        totalSignal: 8,
        recentSignal: 5,
        growthThreshold: 12,
        brightnessThreshold: 16,
        auraThreshold: 6,
        evidenceTypes: ['participate', 'retrieve'],
    );

    expect($visual)
        ->toMatchArray([
            'auraRatio' => 0.8333,
            'brightnessRatio' => 0.3125,
            'description' => 'A well-established light.',
            'evidenceTypes' => ['participate', 'retrieve'],
            'learningPeriods' => [],
            'recentDescription' => 'Recent learning moments are gently lighting this area.',
            'sizeRatio' => 0.6667,
            'sizeTier' => 'beacon',
        ]);
});

test('visual scale caps values and handles unusable thresholds safely', function () {
    $visual = app(CompetenceVisualScale::class)->forTopic(
        totalSignal: 30,
        recentSignal: 4,
        growthThreshold: 0,
        brightnessThreshold: 10,
        auraThreshold: 2,
    );

    expect($visual['sizeRatio'])->toBe(0.0)
        ->and($visual['brightnessRatio'])->toBe(0.4)
        ->and($visual['auraRatio'])->toBe(1.0)
        ->and($visual['recentDescription'])->toBe('Recent learning moments are strongly lighting this area.')
        ->and($visual['sizeTier'])->toBe('spark');
});
