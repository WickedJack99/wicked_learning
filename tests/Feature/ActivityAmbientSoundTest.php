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
            'type' => 'open_practice',
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

    $payload = app(LearningActivitySerializer::class)->serialize($activity);

    expect($payload['config']['competenceTopics'])->toBe([
        ['slug' => 'notes', 'topic' => 'Notes'],
    ]);
});

test('admins can add optional feedback guidance to any activity', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'feedback_purpose' => 'Connect an observation to a reason.',
            'feedback_evidence' => 'Look for a reason grounded in the observation.',
            'feedback_next_action' => 'Try the same idea with a new example.',
            'feedback_rubric' => "Names the observation.\nConnects it to a reason.\nUses a new example.",
            'evidence_concepts' => "Pattern recognition\nCognitive load",
            'title' => 'Explain the observation',
            'type' => 'open_practice',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'explain-the-observation')
        ->firstOrFail();

    expect($activity->config['feedbackGuidance'])->toBe([
        'purpose' => 'Connect an observation to a reason.',
        'evidence' => 'Look for a reason grounded in the observation.',
        'nextAction' => 'Try the same idea with a new example.',
        'rubric' => [
            'Names the observation.',
            'Connects it to a reason.',
            'Uses a new example.',
        ],
    ]);
    expect($activity->config['evidenceConcepts'])->toBe([
        'Pattern recognition',
        'Cognitive load',
    ]);

    $payload = app(LearningActivitySerializer::class)->serialize($activity);

    expect($payload['feedbackGuidance'])->toBe($activity->config['feedbackGuidance']);

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'feedback_evidence' => '',
            'feedback_next_action' => '',
            'feedback_purpose' => '',
            'feedback_rubric' => '',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->refresh()->config)->not->toHaveKey('feedbackGuidance');
});

test('admins can explain the purpose of completion choices', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'completion_choice_prompt' => 'Choose the kind of continuation that supports your next step.',
            'title' => 'Choose your next direction',
            'type' => 'open_practice',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'choose-your-next-direction')
        ->firstOrFail();

    expect($activity->config['completionChoicePrompt'])
        ->toBe('Choose the kind of continuation that supports your next step.');

    expect(app(LearningActivitySerializer::class)->serialize($activity)['completionChoicePrompt'])
        ->toBe('Choose the kind of continuation that supports your next step.');
});
