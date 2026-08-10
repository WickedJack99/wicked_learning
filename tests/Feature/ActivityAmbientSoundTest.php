<?php

use App\Learning\Serializers\LearningActivitySerializer;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\LearningSound;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('admins can configure reusable ambience for any activity type', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $sound = LearningSound::query()->create([
        'icon' => 'ambience',
        'loop' => true,
        'name' => 'Archive wind',
        'play_seconds' => null,
        'slug' => 'archive-wind',
        'url' => '/sounds/archive-wind.ogg',
        'volume' => 45,
    ]);

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'activity_sound_enabled' => true,
            'activity_sound_id' => $sound->id,
            'title' => 'Listen to the archive',
            'type' => 'placeholder',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'listen-to-the-archive')
        ->firstOrFail();

    expect($activity->config['ambientSound'])->toBe([
        'enabled' => true,
        'soundId' => $sound->id,
    ]);

    $payload = app(LearningActivitySerializer::class)->serialize($activity);

    expect($payload['configuredSounds'])->toHaveCount(1)
        ->and($payload['configuredSounds'][0]['id'])->toBe($sound->id);
});

test('clearing ambience removes it without replacing other activity configuration', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = $node->activities()->firstOrFail();
    $activity->forceFill([
        'config' => [
            'ambientSound' => ['enabled' => true, 'soundId' => 999],
            'competenceTopics' => [['topic' => 'Notes', 'slug' => 'notes', 'weight' => 1]],
        ],
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'activity_sound_enabled' => false,
            'activity_sound_id' => '',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $activity->node));

    $activity->refresh();

    expect($activity->config)->not->toHaveKey('ambientSound')
        ->and($activity->config['competenceTopics'][0]['slug'])->toBe('notes');
});
