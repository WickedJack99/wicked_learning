<?php

use App\Learning\Serializers\AdminActivityGraphSerializer;
use App\Learning\Serializers\LearningActivitySerializer;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\LearningSourceRecord;
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

test('admins can save source references for authoring reuse', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.source-records.store'), [
            'anchor' => 'Chapter 3',
            'concepts' => ['Retrieval', 'Spacing'],
            'excerpt' => 'A reusable source note.',
            'publishedAt' => '2026-08-30',
            'publisher' => 'Open Learning Press',
            'rights' => 'CC BY 4.0',
            'title' => 'A reusable source',
            'url' => 'https://example.com/reusable-source',
        ])
        ->assertCreated()
        ->assertJsonPath('sourceRecord.title', 'A reusable source')
        ->assertJsonPath('sourceRecord.publishedAt', '2026-08-30')
        ->assertJsonPath('sourceRecord.concepts', ['Retrieval', 'Spacing']);

    expect(LearningSourceRecord::query()->where('title', 'A reusable source')->exists())->toBeTrue();
});

test('source-linked concepts remain in activity provenance snapshots', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = $node->activities()->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('settings.worlds.activities.update', $activity), [
            'source_references' => [[
                'concepts' => ['Retrieval', 'Spacing'],
                'title' => 'A source with learning context',
                'url' => 'https://example.com/contextual-source',
            ]],
        ])
        ->assertRedirect(route('settings.worlds.nodes.activities.edit', $node));

    expect($activity->refresh()->config['sourceReferences'][0]['concepts'])
        ->toBe(['Retrieval', 'Spacing']);
    expect(app(LearningActivitySerializer::class)->serialize($activity)['sources'][0]['concepts'])
        ->toBe(['Retrieval', 'Spacing']);
});

test('the activity graph exposes a paginated source catalog', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    LearningSourceRecord::query()->create([
        'title' => 'Catalog source',
        'url' => 'https://example.com/catalog-source',
    ]);

    $payload = app(AdminActivityGraphSerializer::class)->serialize($node);

    expect($payload['sourceRecords']['items'])->toContain([
        'anchor' => null,
        'concepts' => [],
        'excerpt' => null,
        'id' => LearningSourceRecord::query()->where('title', 'Catalog source')->value('id'),
        'publishedAt' => null,
        'publisher' => null,
        'rights' => null,
        'title' => 'Catalog source',
        'url' => 'https://example.com/catalog-source',
    ])->and($payload['sourceRecords']['pagination'])->toMatchArray([
        'currentPage' => 1,
        'perPage' => 12,
    ]);
});

test('authors can search and paginate saved source records', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

    foreach (range(1, 13) as $index) {
        LearningSourceRecord::query()->create([
            'title' => "Catalog source {$index}",
            'url' => "https://example.com/catalog-source-{$index}",
        ]);
    }

    LearningSourceRecord::query()->create([
        'publisher' => 'Unique Research Press',
        'title' => 'A differently named source',
        'url' => 'https://example.com/unique-source',
    ]);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.source-records.index').'?page=2&per_page=12')
        ->assertOk()
        ->assertJsonCount(2, 'items')
        ->assertJsonPath('pagination.currentPage', 2)
        ->assertJsonPath('pagination.lastPage', 2)
        ->assertJsonPath('pagination.perPage', 12)
        ->assertJsonPath('pagination.total', 14);

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.source-records.index').'?search=Unique%20Research')
        ->assertOk()
        ->assertJsonCount(1, 'items')
        ->assertJsonPath('items.0.title', 'A differently named source')
        ->assertJsonPath('pagination.total', 1);
});

test('admins can maintain saved sources without changing copied activity references', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $source = LearningSourceRecord::query()->create([
        'title' => 'Source before editing',
        'url' => 'https://example.com/source-before-editing',
    ]);
    $node = LearningNode::query()->where('slug', 'field-notes')->firstOrFail();
    $activity = $node->activities()->firstOrFail();
    $activity->forceFill([
        'config' => [
            'sourceReferences' => [[
                'title' => 'Source before editing',
                'url' => 'https://example.com/source-before-editing',
            ]],
        ],
    ])->save();

    $this->actingAs($admin)
        ->patchJson(route('settings.worlds.source-records.update', $source), [
            'title' => 'Source after editing',
            'url' => 'https://example.com/source-after-editing',
        ])
        ->assertOk()
        ->assertJsonPath('sourceRecord.title', 'Source after editing');

    expect($activity->refresh()->config['sourceReferences'])->toBe([[
        'title' => 'Source before editing',
        'url' => 'https://example.com/source-before-editing',
    ]]);

    $this->actingAs($admin)
        ->deleteJson(route('settings.worlds.source-records.destroy', $source))
        ->assertNoContent();

    expect(LearningSourceRecord::query()->find($source->id))->toBeNull();
});

test('source record updates preserve paginated previous versions', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $source = LearningSourceRecord::query()->create([
        'anchor' => 'Before section',
        'excerpt' => 'The earlier source note.',
        'title' => 'Source before editing',
        'url' => 'https://example.com/source-before-editing',
    ]);

    $this->actingAs($admin)
        ->patchJson(route('settings.worlds.source-records.update', $source), [
            'anchor' => 'After section',
            'excerpt' => 'The updated source note.',
            'title' => 'Source after editing',
            'url' => 'https://example.com/source-after-editing',
        ])
        ->assertOk();

    $this->actingAs($admin)
        ->getJson(route('settings.worlds.source-records.versions', $source).'?page=1&per_page=8')
        ->assertOk()
        ->assertJsonPath('items.0.anchor', 'Before section')
        ->assertJsonPath('items.0.title', 'Source before editing')
        ->assertJsonPath('pagination.page', 1)
        ->assertJsonPath('pagination.perPage', 8)
        ->assertJsonPath('pagination.total', 1);

    expect($source->versions()->count())->toBe(1);
});

test('authors can restore a source record version without losing the current version', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $source = LearningSourceRecord::query()->create([
        'concepts' => ['Retrieval'],
        'title' => 'Source before restore',
        'url' => 'https://example.com/source-before-restore',
    ]);

    $this->actingAs($admin)
        ->patchJson(route('settings.worlds.source-records.update', $source), [
            'concepts' => ['Transfer'],
            'title' => 'Source to restore over',
            'url' => 'https://example.com/source-to-restore-over',
        ])
        ->assertOk();

    $version = $source->versions()->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.source-records.versions.restore', [
            'sourceRecord' => $source,
            'version' => $version,
        ]))
        ->assertOk()
        ->assertJsonPath('sourceRecord.title', 'Source before restore')
        ->assertJsonPath('sourceRecord.concepts', ['Retrieval'])
        ->assertJsonPath('sourceRecord.url', 'https://example.com/source-before-restore');

    expect($source->refresh()->title)->toBe('Source before restore')
        ->and($source->concepts)->toBe(['Retrieval'])
        ->and($source->versions()->count())->toBe(2);
});

test('source record version restores cannot cross source records', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $source = LearningSourceRecord::query()->create([
        'title' => 'Source with history',
        'url' => 'https://example.com/source-with-history',
    ]);
    $otherSource = LearningSourceRecord::query()->create([
        'title' => 'Other source',
        'url' => 'https://example.com/other-source',
    ]);

    $this->actingAs($admin)
        ->patchJson(route('settings.worlds.source-records.update', $source), [
            'title' => 'Updated source',
            'url' => 'https://example.com/updated-source',
        ])
        ->assertOk();

    $version = $source->versions()->firstOrFail();

    $this->actingAs($admin)
        ->postJson(route('settings.worlds.source-records.versions.restore', [
            'sourceRecord' => $otherSource,
            'version' => $version,
        ]))
        ->assertNotFound();

    expect($otherSource->refresh()->title)->toBe('Other source')
        ->and($otherSource->versions()->count())->toBe(0);
});
