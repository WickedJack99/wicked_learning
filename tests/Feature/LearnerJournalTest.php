<?php

use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformJournalSetting;
use App\Models\User;
use Illuminate\Support\Str;

test('an active reflection activity writes a private journal entry', function () {
    [$learner, $activity, $runId] = activeReflectionActivity();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'I can connect the idea to my own practice.',
        ])
        ->assertOk()
        ->assertJsonPath('reflection.question', 'What feels clearer now?');

    $page = LearnerJournalPage::query()->where('user_id', $learner->id)->firstOrFail();
    $reflection = LearnerReflection::query()->where('user_id', $learner->id)->firstOrFail();

    expect($page->title)->toBe('Reflection node - Notice the pattern')
        ->and($page->topic)->toBe('Reflection node')
        ->and($reflection->title)->toBe('Reflection node - Notice the pattern')
        ->and($page->markdown)->toContain('What feels clearer now?')
        ->and($page->markdown)->toContain('I can connect the idea to my own practice.');
});

test('a reflection cannot be recorded outside the active route step', function () {
    [$learner, $activity] = activeReflectionActivity();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => (string) Str::uuid(),
            'reflection' => 'Trying to write outside the active route.',
        ])
        ->assertNotFound();

    expect(LearnerReflection::query()->count())->toBe(0);
});

test('journal expert access remains off when the platform policy is disabled', function () {
    [$learner, $activity, $runId] = activeReflectionActivity();
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => false]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'A private observation.',
            'request_expert_access' => true,
        ])
        ->assertOk();

    expect(LearnerReflection::query()->firstOrFail()->expert_access_requested)->toBeFalse()
        ->and(LearnerJournalPage::query()->firstOrFail()->expert_access_requested)->toBeFalse();
});

test('manual journal pages keep a title separate from their shared category', function () {
    $learner = User::factory()->create();

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.store'), [
            'title' => 'First notebook page',
            'topic' => 'Field studies',
        ])
        ->assertOk()
        ->assertJsonPath('page.title', 'First notebook page')
        ->assertJsonPath('page.topic', 'Field studies');

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.store'), [
            'title' => 'Second notebook page',
            'topic' => 'Field studies',
        ])
        ->assertOk()
        ->assertJsonPath('page.title', 'Second notebook page')
        ->assertJsonPath('page.topic', 'Field studies');

    expect(LearnerJournalPage::query()
        ->where('user_id', $learner->id)
        ->where('topic', 'Field studies')
        ->count())->toBe(2);
});

/** @return array{0: User, 1: LearningActivity, 2: string} */
function activeReflectionActivity(): array
{
    $learner = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => 'journal-world-'.Str::lower(Str::random(8)),
        'title' => 'Journal world',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'journal-map-'.Str::lower(Str::random(8)),
        'title' => 'Journal map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'reflection-node-'.Str::lower(Str::random(8)),
        'title' => 'Reflection node',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'notice-pattern-'.Str::lower(Str::random(8)),
        'type' => 'reflection',
        'title' => 'Notice the pattern',
        'config' => ['prompt' => 'What feels clearer now?'],
        'sort_order' => 10,
    ]);
    $runId = (string) Str::uuid();

    LearnerRouteProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $node->id,
        'start_learning_activity_id' => $activity->id,
        'current_learning_activity_id' => $activity->id,
        'current_play_run_id' => $runId,
        'status' => 'in_progress',
    ]);

    return [$learner, $activity, $runId];
}
