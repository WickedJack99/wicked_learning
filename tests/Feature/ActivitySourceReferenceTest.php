<?php

use App\Learning\Serializers\LearningActivitySerializer;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('admins can attach bounded source references to activities', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'source_references' => [[
                'anchor' => 'Section 2',
                'publishedAt' => '2026-08-30',
                'publisher' => 'Open Learning Press',
                'rights' => 'CC BY 4.0',
                'title' => 'A useful learning source',
                'url' => 'https://example.com/learning-source',
                'excerpt' => 'A short passage that anchors the activity.',
            ]],
            'title' => 'Explain the source',
            'type' => 'open_practice',
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    $activity = LearningActivity::query()
        ->where('slug', 'explain-the-source')
        ->firstOrFail();

    expect($activity->config['sourceReferences'])->toBe([[
        'title' => 'A useful learning source',
        'url' => 'https://example.com/learning-source',
        'publisher' => 'Open Learning Press',
        'publishedAt' => '2026-08-30',
        'rights' => 'CC BY 4.0',
        'anchor' => 'Section 2',
        'excerpt' => 'A short passage that anchors the activity.',
    ]]);

    $payload = app(LearningActivitySerializer::class)->serialize($activity);

    expect($payload['sources'])->toBe($activity->config['sourceReferences'])
        ->and($payload['config'])->not->toHaveKey('sourceReferences');
});

test('clearing source references preserves the rest of activity configuration', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = $node->activities()->firstOrFail();
    $activity->forceFill([
        'config' => [
            'sourceReferences' => [[
                'title' => 'Existing source',
                'url' => 'https://example.com/existing-source',
            ]],
            'nextStep' => 'Keep following the clue.',
        ],
    ])->save();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'source_references' => [],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->refresh()->config)->not->toHaveKey('sourceReferences')
        ->and($activity->config['nextStep'])->toBe('Keep following the clue.');
});

test('source references reject invalid urls and dates', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();

    $this->actingAs($admin)
        ->from(route('settings.worlds.nodes.activities.edit', $node))
        ->post(route('settings.worlds.nodes.activities.store', $node), [
            'source_references' => [[
                'publishedAt' => '30-08-2026',
                'title' => 'Incomplete source',
                'url' => 'not-a-url',
            ]],
            'title' => 'Invalid source',
            'type' => 'open_practice',
        ])
        ->assertSessionHasErrors([
            'source_references.0.publishedAt',
            'source_references.0.url',
        ]);
});
