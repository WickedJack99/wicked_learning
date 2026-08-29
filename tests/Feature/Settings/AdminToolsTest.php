<?php

use App\Models\LearningSound;
use App\Models\LearningTool;
use App\Models\ReusableMediaMetadata;
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
        ->assertRedirect(assetSettingsRoute('visuals'));
});

test('admin users can list tools', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    LearningTool::query()->create([
        'slug' => 'pattern-lens',
        'title' => 'Pattern lens',
        'image_dark' => '/images/tools/pattern-lens-dark.svg',
    ]);

    $this->actingAs($admin)
        ->get(assetSettingsRoute('tools'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->has('assetsWorldObjects.tools', 1)
            ->where('assetsWorldObjects.tools.0.slug', 'pattern-lens')
            ->where('assetsWorldObjects.tools.0.imageDark', '/images/tools/pattern-lens-dark.svg')
        );
});

test('admin users can create and update tools', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->post(route('settings.assets.tools.store'), [
            'title' => 'Pattern lens',
            'description' => 'A lens for clearing static.',
            'image_dark' => '/images/tools/pattern-lens-dark.svg',
            'image_light' => '/images/tools/pattern-lens-light.svg',
            'animation_dark' => '/storage/learning/tools/lens-dark.webp',
            'animation_light' => '/storage/learning/tools/lens-light.webp',
            'animation_duration_seconds' => 1.8,
            'animation_width_percent' => 18,
            'image_width_percent' => 14,
        ])
        ->assertRedirect();

    $tool = LearningTool::query()->where('slug', 'pattern-lens')->firstOrFail();

    expect($tool->title)->toBe('Pattern lens')
        ->and($tool->config['animationDurationSeconds'])->toBe(1.8)
        ->and($tool->config['animationWidthPercent'])->toBe(18)
        ->and($tool->config['imageWidthPercent'])->toBe(14);

    $this->actingAs($admin)
        ->patch(route('settings.assets.tools.update', $tool), [
            'title' => 'Pattern lens revised',
            'slug' => 'pattern-lens',
            'description' => 'Updated tool.',
            'image_dark' => '/images/tools/pattern-lens-dark.svg',
            'image_light' => '/images/tools/pattern-lens-light.svg',
            'animation_duration_seconds' => 2.2,
            'animation_width_percent' => '',
            'image_width_percent' => 22,
        ])
        ->assertRedirect(assetSettingsRoute('tools', ['tool' => $tool->id]));

    $tool->refresh();

    expect($tool->title)->toBe('Pattern lens revised')
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

test('admin users can paginate reusable image assets', function () {
    Storage::fake('public');

    foreach (['one', 'two', 'three', 'four'] as $name) {
        Storage::disk('public')->put(
            "learning/media/picker-{$name}.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
        );
    }

    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $response = $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-images', [
            'q' => 'picker',
            'page' => 2,
            'per_page' => 2,
        ]))
        ->assertOk()
        ->assertJsonPath('pagination.currentPage', 2)
        ->assertJsonPath('pagination.lastPage', 2)
        ->assertJsonPath('pagination.perPage', 2)
        ->assertJsonPath('pagination.total', 4);

    expect($response->json('assets'))->toHaveCount(2);
});

test('admin users can filter reusable image assets by tag', function () {
    Storage::fake('public');
    Storage::disk('public')->put(
        'learning/media/tool-lens.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
    );
    Storage::disk('public')->put(
        'learning/media/forest-background.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
    );
    ReusableMediaMetadata::query()->create([
        'url' => '/storage/learning/media/tool-lens.svg',
        'tags' => ['tool'],
    ]);
    ReusableMediaMetadata::query()->create([
        'url' => '/storage/learning/media/forest-background.svg',
        'tags' => ['background'],
    ]);
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $assets = $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-images', [
            'q' => 'lens',
            'tag' => 'TOOL',
        ]))
        ->assertOk()
        ->json('assets');

    expect($assets)->toHaveCount(1)
        ->and($assets[0]['url'])->toBe('/storage/learning/media/tool-lens.svg')
        ->and($assets[0]['tags'])->toBe(['tool']);

    $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-images', [
            'q' => 'lens',
            'tag' => 'background',
        ]))
        ->assertOk()
        ->assertJsonCount(0, 'assets');
});

test('admin users can save and search reusable image metadata', function () {
    Storage::fake('public');
    Storage::disk('public')->put(
        'learning/media/quiet-portal.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" />',
    );
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->patch(route('settings.assets.media.metadata.update'), [
            'url' => '/storage/learning/media/quiet-portal.svg',
            'display_name' => 'Quiet portal',
            'category' => 'Map background',
            'tags' => ['Portal', 'night sky'],
            'has_transparency' => false,
            'is_animated' => false,
        ])
        ->assertRedirect(assetSettingsRoute('visuals'));

    $metadata = ReusableMediaMetadata::query()->firstOrFail();

    expect($metadata->display_name)->toBe('Quiet portal')
        ->and($metadata->category)->toBe('Map background')
        ->and($metadata->tags)->toBe(['portal', 'night sky'])
        ->and($metadata->has_transparency)->toBeFalse()
        ->and($metadata->is_animated)->toBeFalse();

    $assets = $this->actingAs($admin)
        ->getJson(route('settings.assets.reusable-images', ['q' => 'quiet portal']))
        ->assertOk()
        ->json('assets');

    expect($assets)->toHaveCount(1)
        ->and($assets[0]['label'])->toBe('Quiet portal')
        ->and($assets[0]['category'])->toBe('Map background')
        ->and($assets[0]['tags'])->toBe(['portal', 'night sky'])
        ->and($assets[0]['hasTransparency'])->toBeFalse()
        ->and($assets[0]['isAnimated'])->toBeFalse();
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
        ->patch(route('settings.assets.media.metadata.update'), [
            'url' => '/storage/learning/media/old-wall.svg',
            'category' => 'Obstacle',
            'tags' => ['gate'],
        ])
        ->assertRedirect(assetSettingsRoute('visuals'));

    $this->actingAs($admin)
        ->get(assetSettingsRoute('visuals'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->has('assetsWorldObjects.visuals')
            ->where('assetsWorldObjects.visuals.0.referenceCount', 1)
            ->where('assetsWorldObjects.visuals.0.referenceGroups', [
                ['count' => 1, 'label' => 'Tools'],
            ])
        );

    $this->actingAs($admin)
        ->post(route('settings.assets.media.replace'), [
            'url' => '/storage/learning/media/old-wall.svg',
            'file' => UploadedFile::fake()->create('new-wall.svg', 4, 'image/svg+xml'),
        ])
        ->assertRedirect(assetSettingsRoute('visuals'));

    $tool->refresh();

    expect($tool->image_dark)->toStartWith('/storage/learning/media/')
        ->and($tool->image_dark)->not->toBe('/storage/learning/media/old-wall.svg')
        ->and(ReusableMediaMetadata::query()->where('url', $tool->image_dark)->value('category'))
        ->toBe('Obstacle');
    Storage::disk('public')->assertExists('learning/media/old-wall.svg');

    $replacedUrl = $tool->image_dark;

    $this->actingAs($admin)
        ->delete(route('settings.assets.media.destroy'), [
            'url' => $replacedUrl,
        ])
        ->assertRedirect(assetSettingsRoute('visuals'));

    expect($tool->refresh()->image_dark)->toBeNull();
    expect(ReusableMediaMetadata::query()->where('url', $replacedUrl)->exists())
        ->toBeFalse();
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
        ->assertRedirect(assetSettingsRoute('sounds', ['sound' => $sound->id]));

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

function assetSettingsRoute(string $asset, array $extra = []): string
{
    return route('settings.index', [
        'panel' => 'admin-assets-world-objects',
        'asset' => $asset,
        ...$extra,
    ]);
}
