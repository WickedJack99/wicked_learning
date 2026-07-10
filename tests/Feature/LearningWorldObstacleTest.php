<?php

use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;

test('learners can resolve an obstacle with an owned configured tool', function () {
    $learner = User::factory()->create([
        'email' => 'test@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $activity = LearningActivity::query()
        ->where('slug', 'clear-the-static-gate')
        ->firstOrFail();
    $tool = LearningTool::query()->where('slug', 'signal-lens')->firstOrFail();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.obstacle-tool', $activity), [
            'tool_id' => $tool->id,
        ])
        ->assertOk()
        ->assertJsonPath('result.isUseful', true)
        ->assertJsonPath('result.toolId', $tool->id);
});

test('owned tools only resolve obstacles when the obstacle allows them', function () {
    $learner = User::factory()->create([
        'email' => 'test@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $activity = LearningActivity::query()
        ->where('slug', 'clear-the-static-gate')
        ->firstOrFail();
    $wrongTool = LearningTool::query()->create([
        'slug' => 'quiet-wrench',
        'title' => 'Quiet wrench',
    ]);

    $learner->learningTools()->attach($wrongTool, ['acquired_at' => now()]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.obstacle-tool', $activity), [
            'tool_id' => $wrongTool->id,
        ])
        ->assertOk()
        ->assertJsonPath('result.isUseful', false)
        ->assertJsonPath('result.toolId', $wrongTool->id);
});

test('learners can receive a tool from a grant tool activity', function () {
    $learner = User::factory()->create([
        'email' => 'test@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $tool = LearningTool::query()->create([
        'slug' => 'calibration-key',
        'title' => 'Calibration key',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'receive-calibration-key',
        'type' => 'tool_grant',
        'title' => 'Receive calibration key',
        'config' => ['toolId' => $tool->id],
        'sort_order' => 99,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.grant-tool', $activity))
        ->assertOk()
        ->assertJsonPath('tool.id', $tool->id)
        ->assertJsonPath('tool.title', 'Calibration key');

    expect($learner->learningTools()->whereKey($tool->id)->exists())->toBeTrue();
});

test('learners can receive a tool from an npc dialogue node', function () {
    $learner = User::factory()->create([
        'email' => 'test@example.com',
    ]);

    $this->seed(DemoLearningWorldSeeder::class);

    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();
    $tool = LearningTool::query()->create([
        'slug' => 'soft-spoken-compass',
        'title' => 'Soft-spoken compass',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'meet-the-toolkeeper',
        'type' => 'npc_dialogue',
        'title' => 'Meet the toolkeeper',
        'config' => [],
        'sort_order' => 100,
    ]);
    $dialogueNode = NpcDialogueNode::query()->create([
        'learning_activity_id' => $activity->id,
        'type' => 'npc_interaction',
        'title' => 'Toolkeeper',
        'body' => 'Take this. It may help later.',
        'config' => ['toolId' => $tool->id],
        'sort_order' => 1,
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.npc-dialogue-nodes.grant-tool', $dialogueNode))
        ->assertOk()
        ->assertJsonPath('tool.id', $tool->id)
        ->assertJsonPath('tool.title', 'Soft-spoken compass');

    expect($learner->learningTools()->whereKey($tool->id)->exists())->toBeTrue();
});
