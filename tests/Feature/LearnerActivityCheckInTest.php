<?php

use App\Models\LearnerActivityProgress;
use App\Models\LearnerReviewAttempt;
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

test('a learner can save a private note without choosing a feeling phrase', function () {
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
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'note' => 'The quiet example made the pattern easier to hold onto.',
        ])
        ->assertOk()
        ->assertJsonPath('progress.metadata.learningCheckIn.feeling', null)
        ->assertJsonPath('progress.metadata.learningCheckIn.note', 'The quiet example made the pattern easier to hold onto.');

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('competenceMap.checkIns.0.feeling', null)
            ->where('competenceMap.checkIns.0.note', 'The quiet example made the pattern easier to hold onto.'));
});

test('a learner can save an optional next direction with a check-in', function () {
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
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'next_direction' => 'related',
        ])
        ->assertOk()
        ->assertJsonPath('progress.metadata.learningCheckIn.feeling', null)
        ->assertJsonPath('progress.metadata.learningCheckIn.nextDirection', 'related');

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata['learningCheckIn'])
        ->toMatchArray([
            'feeling' => null,
            'nextDirection' => 'related',
            'recordedAt' => now()->toIso8601String(),
        ]);

    $this->actingAs($learner)
        ->get(route('competence.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('competenceMap.checkIns.0.nextDirection', 'related'));

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertOk()
        ->assertJsonPath('checkIns.0.nextDirection', 'related');
});

test('a revisit check-in persists its due timestamp', function () {
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
        'metadata' => [],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.check-in', $activity), [
            'next_direction' => 'revisit',
        ])
        ->assertOk();

    expect(LearnerActivityProgress::query()->firstOrFail())
        ->revisit_status->toBe(LearnerActivityProgress::REVISIT_STATUS_PENDING)
        ->revisit_available_at->toEqual(now()->addDays(3));
});

test('a check-in only accepts supported next directions', function () {
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
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
            'next_direction' => 'notify-me-later',
        ])
        ->assertStatus(422);
});

test('a learner can revisit a chosen activity after a spacing window and defer it', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $activity] = checkInActivityContext();
    $recordedAt = now()->subDays(4)->toIso8601String();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subDays(4),
        'completed_at' => now()->subDays(4),
        'metadata' => [
            'learningCheckIns' => [[
                'feeling' => 'forming',
                'nextDirection' => 'revisit',
                'recordedAt' => $recordedAt,
            ]],
        ],
    ]);

    expect(LearnerActivityProgress::query()->firstOrFail())
        ->revisit_status->toBe(LearnerActivityProgress::REVISIT_STATUS_PENDING)
        ->revisit_available_at->toEqual(now()->subDay());

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertOk()
        ->assertJsonPath('revisitInvitations.0.activityTitle', 'Check-in Activity')
        ->assertJsonPath('revisitInvitations.0.availableSince', $recordedAt)
        ->assertJsonPath('revisitInvitations.0.availableAt', now()->subDay()->toIso8601String())
        ->assertJsonPath('revisitInvitations.0.revisitReason', 'pause');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.revisit-invitation', $activity), [
            'action' => 'snooze',
        ])
        ->assertOk()
        ->assertJsonPath('progress.metadata.revisitInvitation.status', 'snoozed');

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata['revisitInvitation']['until'])
        ->toBe(now()->addDays(7)->toIso8601String());

    expect(LearnerActivityProgress::query()->firstOrFail())
        ->revisit_status->toBe(LearnerActivityProgress::REVISIT_STATUS_SNOOZED)
        ->revisit_available_at->toEqual(now()->addDays(7));

    Carbon::setTestNow('2026-09-07 14:30:00');

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertJsonCount(1, 'revisitInvitations')
        ->assertJsonPath('revisitInvitations.0.revisitReason', 'later')
        ->assertJsonPath('revisitInvitations.0.availableAt', now()->subDay()->toIso8601String());
});

test('completing a reopened activity consumes its revisit invitation', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subDays(4),
        'completed_at' => now()->subDays(4),
        'metadata' => [
            'learningCheckIn' => [
                'nextDirection' => 'revisit',
                'recordedAt' => now()->subDays(4)->toIso8601String(),
            ],
            'revisitInvitation' => [
                'status' => 'snoozed',
                'until' => now()->subDay()->toIso8601String(),
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'is_revisit' => true,
            'status' => 'completed',
        ])
        ->assertOk()
        ->assertJsonPath('progress.metadata.revisitInvitation', null);

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata)
        ->not->toHaveKey('revisitInvitation');

    expect(LearnerActivityProgress::query()->firstOrFail())
        ->revisit_status->toBe(LearnerActivityProgress::REVISIT_STATUS_NONE)
        ->revisit_available_at->toBeNull();

    expect(LearnerReviewAttempt::query()->firstOrFail())
        ->user_id->toBe($learner->id)
        ->learning_activity_id->toBe($activity->id)
        ->attempt_number->toBe(2)
        ->source->toBe('revisit')
        ->outcome->toBeNull()
        ->assistance_level->toBe('untracked')
        ->attempted_at->toEqual(now());
});

test('a learner can hide a revisit invitation and unsupported actions are rejected', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subDays(4),
        'completed_at' => now()->subDays(4),
        'metadata' => [
            'learningCheckIn' => [
                'nextDirection' => 'revisit',
                'recordedAt' => now()->subDays(4)->toIso8601String(),
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.revisit-invitation', $activity), [
            'action' => 'dismiss',
        ])
        ->assertOk();

    expect(LearnerActivityProgress::query()->firstOrFail()->metadata['revisitInvitation']['status'])
        ->toBe('dismissed');

    expect(LearnerActivityProgress::query()->firstOrFail())
        ->revisit_status->toBe(LearnerActivityProgress::REVISIT_STATUS_DISMISSED)
        ->revisit_available_at->toBeNull();

    $invalidActionResponse = $this->actingAs($learner)
        ->postJson(route('learning.activities.revisit-invitation', $activity), [
            'action' => 'repeat-every-day',
        ]);

    expect($invalidActionResponse->status())->toBe(422);
});

test('a revisit marker does not create a review attempt before the activity is due', function () {
    [$learner, $activity] = checkInActivityContext();

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'is_revisit' => true,
            'status' => 'completed',
        ])
        ->assertOk();

    expect(LearnerReviewAttempt::query()->count())->toBe(0);
});

test('a newer check-in direction replaces an older revisit invitation', function () {
    Carbon::setTestNow('2026-08-30 14:30:00');
    [$learner, $activity] = checkInActivityContext();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subDays(4),
        'completed_at' => now()->subDays(4),
        'metadata' => [
            'learningCheckIns' => [
                [
                    'nextDirection' => 'revisit',
                    'recordedAt' => now()->subDays(5)->toIso8601String(),
                ],
                [
                    'nextDirection' => 'settle',
                    'recordedAt' => now()->subDays(4)->toIso8601String(),
                ],
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertJsonCount(0, 'revisitInvitations');
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
            ->where('competenceMap.checkIns.0.activityHref', route('learning.nodes.play', [
                'activity_id' => $activity->id,
                'node' => $activity->node,
            ]))
            ->where('competenceMap.checkIns.0.nodeHref', route('learning.nodes.play', ['node' => $activity->learning_node_id]))
            ->where('competenceMap.checkIns.0.topics.0.slug', 'systems-thinking')
            ->where('competenceMap.checkIns.0.topics.0.name', 'Systems Thinking')
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
        'config' => [
            'competenceTopics' => [
                ['topic' => 'Systems Thinking', 'weight' => 1],
            ],
        ],
        'sort_order' => 10,
    ]);

    return [$learner, $activity];
}
