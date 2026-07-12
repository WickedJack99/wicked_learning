<?php

use App\Learning\Services\ItemGrantActivityConfiguration;
use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\LearningItem;
use App\Models\LearningNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('item grant activity configuration stores themed backgrounds', function () {
    $config = app(ItemGrantActivityConfiguration::class)->fromData([
        'item_grant_background_dark' => '/storage/learning/items/grant-dark.webp',
        'item_grant_background_light' => '/storage/learning/items/grant-light.webp',
        'item_grant_items' => [
            ['itemId' => 12, 'quantity' => 3],
        ],
        'item_grant_probability_percent' => 72.5,
    ]);

    expect($config['backgroundDark'])->toBe('/storage/learning/items/grant-dark.webp')
        ->and($config['backgroundLight'])->toBe('/storage/learning/items/grant-light.webp')
        ->and($config['items'])->toBe([
            ['itemId' => 12, 'quantity' => 3],
        ])
        ->and($config['probabilityPercent'])->toBe(72.5);
});

test('item grant activities persist the roll and do not grant repeatedly', function () {
    $learner = User::factory()->create([
        'email' => 'items@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'portal-key',
        'title' => 'Portal key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'receive-portal-key',
        'type' => 'item_grant',
        'title' => 'Receive portal key',
        'config' => [
            'items' => [
                ['itemId' => $item->id, 'quantity' => 2],
            ],
            'probabilityPercent' => 100,
        ],
        'sort_order' => 110,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 2);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-items', $activity))
        ->assertOk()
        ->assertJsonPath('result.success', true)
        ->assertJsonPath('inventory.0.quantity', 2);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->metadata['itemGrant']['rolledAt'] ?? null)->toBeString()
        ->and($learner->learningItems()->whereKey($item->id)->first()?->pivot->quantity)->toBe(2);
});

test('item obstacles consume matching items and only continue after conditions are met', function () {
    $learner = User::factory()->create([
        'email' => 'item-obstacle@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $item = LearningItem::query()->create([
        'slug' => 'gate-gem',
        'title' => 'Gate gem',
    ]);
    $learner->learningItems()->attach($item, [
        'quantity' => 1,
        'acquired_at' => now(),
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'socket-the-gem',
        'type' => 'item_obstacle',
        'title' => 'Socket the gem',
        'config' => [
            'slots' => [
                ['itemId' => $item->id, 'x' => 50, 'y' => 50, 'width' => 10],
            ],
            'lockMinutes' => 0,
        ],
        'sort_order' => 120,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-continue', $activity))
        ->assertOk()
        ->assertJsonPath('state.canContinue', false)
        ->assertJsonPath('state.conditionsMet', false);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-slot', $activity), [
            'item_id' => $item->id,
            'slot_index' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('state.conditionsMet', true)
        ->assertJsonPath('inventory', []);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.item-obstacle-continue', $activity))
        ->assertOk()
        ->assertJsonPath('state.canContinue', true);

    $progress = LearnerActivityProgress::query()
        ->where('user_id', $learner->id)
        ->where('learning_activity_id', $activity->id)
        ->firstOrFail();

    expect($progress->status)->toBe('completed')
        ->and($learner->learningItems()->whereKey($item->id)->exists())->toBeFalse();
});
