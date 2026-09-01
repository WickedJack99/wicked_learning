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

test('admins can add optional time guidance to any activity', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'time_guide_minutes' => 25,
            'title' => 'Plan the observation',
            'type' => 'open_practice',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'plan-the-observation')
        ->firstOrFail();

    $payload = app(LearningActivitySerializer::class)->serialize($activity);

    expect($activity->config['timeGuideMinutes'])->toBe(25)
        ->and($payload['timeGuideMinutes'])->toBe(25)
        ->and($payload['config'])
        ->not->toHaveKey('timeGuideMinutes');

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'updated_at' => $activity->updated_at?->toIso8601String(),
            'time_guide_minutes' => null,
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->refresh()->config)->not->toHaveKey('timeGuideMinutes');
});

test('activity time guidance is limited to a practical planning range', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'time_guide_minutes' => 181,
            'title' => 'Plan too long',
            'type' => 'open_practice',
        ])
        ->assertSessionHasErrors('time_guide_minutes');
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
            'updated_at' => $activity->updated_at?->toIso8601String(),
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
            'feedback_response' => 'Compare your explanation with the observation before continuing.',
            'feedback_independent_check_feedback' => 'Compare the new example with the original observation and notice what stayed true.',
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
        'responseFeedback' => 'Compare your explanation with the observation before continuing.',
        'independentCheckFeedback' => 'Compare the new example with the original observation and notice what stayed true.',
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
            'updated_at' => $activity->updated_at?->toIso8601String(),
            'feedback_evidence' => '',
            'feedback_next_action' => '',
            'feedback_purpose' => '',
            'feedback_response' => '',
            'feedback_independent_check_feedback' => '',
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
