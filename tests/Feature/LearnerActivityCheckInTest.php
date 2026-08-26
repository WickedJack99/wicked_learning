<?php

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

test('a learner can keep a private learning check-in after completing an activity', function () {
    Carbon::setTestNow('2026-08-26 14:30:00');
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subMinute(),
        'completed_at' => now()->subMinute(),
        'metadata' => ['obstacle' => ['destroyedAt' => now()->subMinute()->toIso8601String()]],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'stuck',
        ])
        ->assertOk()
        ->assertJsonPath('progress.metadata.obstacle.destroyedAt', now()->subMinute()->toIso8601String())
        ->assertJsonPath('progress.metadata.learningCheckIn.feeling', 'stuck')
        ->assertJsonPath('progress.metadata.learningCheckIn.recordedAt', now()->toIso8601String());

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata['learningCheckIn'])
        ->toBe([
            'feeling' => 'stuck',
            'recordedAt' => now()->toIso8601String(),
        ]);

    Carbon::setTestNow('2026-08-26 14:31:00');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'clearer',
        ])
        ->assertOk();

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata['learningCheckIns'])
        ->toHaveCount(2)
        ->and(LearnerActivityProgress::query()->firstOrFail()->metadata['learningCheckIns'][0]['feeling'])
        ->toBe('stuck')
        ->and(LearnerActivityProgress::query()->firstOrFail()->metadata['learningCheckIns'][1]['feeling'])
        ->toBe('clearer');
});

test('a learner cannot record a check-in before completing an activity', function () {
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'reached',
        'attempt_count' => 1,
        'reached_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'clearer',
        ])
        ->assertNotFound();

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata)->toBe([]);
});

test('a learner cannot write a check-in onto another learners progress', function () {
    [$learner, $activity] = checkInActivityContext();
    $otherLearner = User::factory()->create();
    LearnerActivityProgress::query()->create([
        'user_id' => $otherLearner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now(),
        'completed_at' => now(),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'forming',
        ])
        ->assertNotFound();

    expect(LearnerActivityProgress::query()
        ->where('user_id', $otherLearner->id)
        ->firstOrFail()
        ->metadata)->toBe([]);
});

test('the competence page shows only the current learners private check-ins', function () {
    Carbon::setTestNow('2026-08-26 15:00:00');
    [$learner, $activity] = checkInActivityContext();
    $otherLearner = User::factory()->create();

    foreach ([$learner, $otherLearner] as $owner) {
        LearnerActivityProgress::query()->create([
            'user_id' => $owner->id,
            'learning_node_id' => $activity->learning_node_id,
            'learning_activity_id' => $activity->id,
            'status' => 'completed',
            'attempt_count' => 1,
            'reached_at' => now()->subMinute(),
            'completed_at' => now()->subMinute(),
            'metadata' => [
                'learningCheckIn' => [
                    'feeling' => $owner->is($learner) ? 'clearer' : 'stuck',
                    'recordedAt' => now()->toIso8601String(),
                ],
            ],
        ]);
    }

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('competence/index')
            ->has('competenceMap.checkIns', 1)
            ->where('competenceMap.checkIns.0.activityTitle', 'Check-in Activity')
            ->where('competenceMap.checkIns.0.feeling', 'clearer')
        );
});

test('the learning pulse timeline keeps repeated observations in time order', function () {
    Carbon::setTestNow('2026-08-26 15:00:00');
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 2,
        'reached_at' => now()->subMinutes(3),
        'completed_at' => now()->subMinutes(3),
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'stuck',
        ])
        ->assertOk();

    Carbon::setTestNow('2026-08-26 15:02:00');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'clearer',
        ])
        ->assertOk();

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('competenceMap.checkIns.0.feeling', 'clearer')
            ->where('competenceMap.checkIns.1.feeling', 'stuck')
        );
});

test('a check-in only accepts the supported learning pulse phrases', function () {
    [$learner, $activity] = checkInActivityContext();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'feeling' => 'excellent',
        ])
        ->assertStatus(422);
});

/** @return array{User, LearningActivity} */
function checkInActivityContext(): array
{
    $learner = User::factory()->create();
    $world = LearningWorld::query()->create([
        'slug' => 'check-in-world',
        'title' => 'Check-in World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $learner->id,
        'slug' => 'check-in-map',
        'title' => 'Check-in Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'check-in-node',
        'title' => 'Check-in Node',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'check-in-activity',
        'type' => 'reflection',
        'title' => 'Check-in Activity',
        'config' => [],
        'sort_order' => 10,
    ]);

    return [$learner, $activity];
}
