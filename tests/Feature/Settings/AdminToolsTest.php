<?php

use App\Models\LearningTool;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

test('admin users can open the asset hub', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.assets.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/assets/index')
        );
});

test('admin users can list tools', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    LearningTool::query()->create([
        'slug' => 'signal-lens',
        'title' => 'Signal lens',
        'image_dark' => '/images/tools/signal-lens-dark.svg',
    ]);

    $this->actingAs($admin)
        ->get(route('settings.assets.tools'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/assets/tools')
            ->has('tools', 1)
            ->where('tools.0.slug', 'signal-lens')
            ->where('tools.0.imageDark', '/images/tools/signal-lens-dark.svg')
        );
});

test('admin users can create and update tools', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.assets.tools.store'), [
            'title' => 'Signal lens',
            'description' => 'A lens for clearing static.',
            'image_dark' => '/images/tools/signal-lens-dark.svg',
            'image_light' => '/images/tools/signal-lens-light.svg',
            'animation_dark' => '/storage/learning/tools/lens-dark.webp',
            'animation_light' => '/storage/learning/tools/lens-light.webp',
            'animation_duration_seconds' => 1.8,
        ])
        ->assertRedirect();

    $tool = LearningTool::query()->where('slug', 'signal-lens')->firstOrFail();

    expect($tool->title)->toBe('Signal lens')
        ->and($tool->config['animationDurationSeconds'])->toBe(1.8);

    $this->actingAs($admin)
        ->patch(route('settings.assets.tools.update', $tool), [
            'title' => 'Signal lens revised',
            'slug' => 'signal-lens',
            'description' => 'Updated tool.',
            'image_dark' => '/images/tools/signal-lens-dark.svg',
            'image_light' => '/images/tools/signal-lens-light.svg',
            'animation_duration_seconds' => 2.2,
        ])
        ->assertRedirect(route('settings.assets.tools', ['tool' => $tool->id]));

    $tool->refresh();

    expect($tool->title)->toBe('Signal lens revised')
        ->and($tool->config['animationDurationSeconds'])->toBe(2.2);
});

test('admin users can upload tool media', function () {
    Storage::fake('public');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $response = $this->actingAs($admin)
        ->postJson(route('settings.assets.tool-media.store'), [
            'file' => UploadedFile::fake()->create('lens.svg', 4, 'image/svg+xml'),
        ])
        ->assertOk()
        ->assertJsonStructure(['durationSeconds', 'url']);

    $url = $response->json('url');

    expect($url)->toStartWith('/storage/learning/tools/');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));
});
