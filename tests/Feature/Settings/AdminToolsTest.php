<?php

use App\Models\LearningSound;
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
            'animation_width_percent' => 18,
            'image_width_percent' => 14,
        ])
        ->assertRedirect();

    $tool = LearningTool::query()->where('slug', 'signal-lens')->firstOrFail();

    expect($tool->title)->toBe('Signal lens')
        ->and($tool->config['animationDurationSeconds'])->toBe(1.8)
        ->and($tool->config['animationWidthPercent'])->toBe(18)
        ->and($tool->config['imageWidthPercent'])->toBe(14);

    $this->actingAs($admin)
        ->patch(route('settings.assets.tools.update', $tool), [
            'title' => 'Signal lens revised',
            'slug' => 'signal-lens',
            'description' => 'Updated tool.',
            'image_dark' => '/images/tools/signal-lens-dark.svg',
            'image_light' => '/images/tools/signal-lens-light.svg',
            'animation_duration_seconds' => 2.2,
            'animation_width_percent' => '',
            'image_width_percent' => 22,
        ])
        ->assertRedirect(route('settings.assets.tools', ['tool' => $tool->id]));

    $tool->refresh();

    expect($tool->title)->toBe('Signal lens revised')
        ->and($tool->config['animationDurationSeconds'])->toBe(2.2)
        ->and($tool->config['animationWidthPercent'])->toBeNull()
        ->and($tool->config['imageWidthPercent'])->toBe(22);
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

test('admin users can search reusable image assets', function () {
    Storage::fake('public');
    Storage::disk('public')->put(
        'learning/nodes/reusable-crystal.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
    );
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $assets = $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-images', ['q' => 'crystal']))
        ->assertOk()
        ->assertJsonStructure([
            'assets' => [
                '*' => ['canDelete', 'extension', 'label', 'source', 'uploaded', 'url'],
            ],
        ])
        ->json('assets');

    expect(collect($assets)->pluck('url'))->toContain('/storage/learning/nodes/reusable-crystal.svg');
});

test('admin users can replace and delete reusable media assets', function () {
    Storage::fake('public');
    Storage::disk('public')->put(
        'learning/media/old-wall.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
    );
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $tool = LearningTool::query()->create([
        'slug' => 'wall-breaker',
        'title' => 'Wall breaker',
        'image_dark' => '/storage/learning/media/old-wall.svg',
    ]);

    $this->actingAs($admin)
        ->get(route('settings.assets.media'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/assets/media')
            ->has('assets')
        );

    $this->actingAs($admin)
        ->post(route('settings.assets.media.replace'), [
            'url' => '/storage/learning/media/old-wall.svg',
            'file' => UploadedFile::fake()->create('new-wall.svg', 4, 'image/svg+xml'),
        ])
        ->assertRedirect(route('settings.assets.media'));

    $tool->refresh();

    expect($tool->image_dark)->toStartWith('/storage/learning/media/')
        ->and($tool->image_dark)->not->toBe('/storage/learning/media/old-wall.svg');
    Storage::disk('public')->assertExists('learning/media/old-wall.svg');

    $this->actingAs($admin)
        ->delete(route('settings.assets.media.destroy'), [
            'url' => $tool->image_dark,
        ])
        ->assertRedirect(route('settings.assets.media'));

    expect($tool->refresh()->image_dark)->toBeNull();
});

test('admin users can manage reusable sounds', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.assets.sounds.store'), [
            'name' => 'Signal chime',
            'slug' => 'signal-chime',
            'icon' => 'ui',
            'url' => '/sounds/soft-chime.wav',
            'volume' => 62,
            'play_seconds' => null,
            'loop' => false,
        ])
        ->assertRedirect();

    $sound = LearningSound::query()->where('slug', 'signal-chime')->firstOrFail();

    expect($sound->name)
        ->toBe('Signal chime')
        ->and($sound->volume)->toBe(62.0)
        ->and($sound->loop)->toBeFalse();

    $this->actingAs($admin)
        ->patch(route('settings.assets.sounds.update', $sound), [
            'name' => 'Signal ambience',
            'slug' => 'signal-chime',
            'icon' => 'ambience',
            'url' => '/sounds/quiet-pulse.wav',
            'volume' => 30,
            'play_seconds' => 5,
            'loop' => true,
        ])
        ->assertRedirect(route('settings.assets.sounds', ['sound' => $sound->id]));

    expect($sound->refresh()->name)
        ->toBe('Signal ambience')
        ->and($sound->loop)->toBeTrue()
        ->and($sound->play_seconds)->toBe(5.0);
});

test('admin users can upload and search reusable sound assets', function () {
    Storage::fake('public');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    LearningSound::query()->create([
        'name' => 'Crystal bell',
        'slug' => 'crystal-bell',
        'icon' => 'sfx',
        'url' => '/sounds/soft-chime.wav',
        'volume' => 70,
        'loop' => false,
    ]);

    $url = $this->actingAs($admin)
        ->postJson(route('settings.assets.sound-media.store'), [
            'file' => UploadedFile::fake()->create('tone.wav', 12, 'audio/wav'),
        ])
        ->assertOk()
        ->assertJsonStructure(['url'])
        ->json('url');

    expect($url)->toStartWith('/storage/learning/sounds/');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));

    $sounds = $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-sounds', ['q' => 'crystal']))
        ->assertOk()
        ->assertJsonStructure([
            'sounds' => [
                '*' => ['icon', 'id', 'loop', 'name', 'playSeconds', 'slug', 'url', 'volume'],
            ],
        ])
        ->json('sounds');

    expect(collect($sounds)->pluck('slug'))->toContain('crystal-bell');
});
