<?php

use App\Learning\CurrentWorldResolver;
use App\Models\LearningWorld;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('settings loads heavy collections only for the active workspace', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
    ]);

    LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Performance World',
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('worldGraph.world.title', 'Performance World')
            ->where('assetsWorldObjects', [
                'items' => [],
                'sounds' => [],
                'tools' => [],
                'visuals' => [],
            ])
            ->where('colorPaletteSettings', null)
            ->where('learningSupportSettings', [])
            ->where('adminUsers', [])
        );
});
