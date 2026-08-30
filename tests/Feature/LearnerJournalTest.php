<?php

use App\Models\LearnerActivityProgress;
use App\Models\LearnerEvidenceEvent;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\LearningWorld;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\PlatformJournalSetting;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

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

test('a transfer reflection records its changed context as structured private evidence', function () {
    [$learner, $activity, $runId] = activeReflectionActivity();
    $activity->update([
        'config' => [
            ...$activity->config,
            'learningIntent' => 'transfer',
            'feedbackGuidance' => [
                'evidence' => 'Connects the idea to a changed context.',
                'rubric' => [
                    'Names the changed context.',
                    'Connects the idea to the new situation.',
                ],
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'I used the idea to interpret a new example.',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('response_context');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'I used the idea to interpret a new example.',
            'response_context' => 'A different example from my current project.',
            'observed_cues' => [
                'Connects the idea to the new situation.',
                'Not an authored cue.',
            ],
        ])
        ->assertOk()
        ->assertJsonPath('reflection.responseType', 'transfer')
        ->assertJsonPath('reflection.responseContext', 'A different example from my current project.')
        ->assertJsonPath('reflection.observedCues', ['Connects the idea to the new situation.']);

    $reflection = LearnerReflection::query()->firstOrFail();

    expect($reflection->response_type)->toBe('transfer')
        ->and($reflection->response_context)->toBe('A different example from my current project.')
        ->and($reflection->observed_cues)->toBe(['Connects the idea to the new situation.'])
        ->and($reflection->page->markdown)->toContain('**What I noticed**')
        ->and($reflection->page->markdown)->toContain('**Changed context**');

    $this->actingAs($learner)
        ->postJson(route('learning.activities.progress', $activity), [
            'confidence' => 'leaning',
            'play_run_id' => $runId,
            'status' => 'completed',
            'observed_cues' => ['Connects the idea to the new situation.'],
        ])
        ->assertOk();

    expect(LearnerEvidenceEvent::query()
        ->where('user_id', $learner->id)
        ->firstOrFail()
        ->observed_cues)
        ->toBe(['Connects the idea to the new situation.'])
        ->and(LearnerEvidenceEvent::query()
            ->where('user_id', $learner->id)
            ->firstOrFail()
            ->confidence)
        ->toBe('leaning');
});

test('a review activity offers earlier private reflections from the same journal topic', function () {
    [$learner, $activity] = activeReflectionActivity();
    $activity->update([
        'config' => [
            'learningIntent' => 'review',
            'prompt' => 'What feels different now?',
            'topic' => 'Systems Thinking',
            'feedbackGuidance' => [
                'purpose' => 'Notice what changed in your understanding.',
            ],
        ],
    ]);

    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Systems Thinking',
        'topic' => 'Systems Thinking',
        'subtopic' => '',
        'markdown' => 'Earlier note',
        'preferred_mode' => 'view',
    ]);
    LearnerReflection::query()->create([
        'user_id' => $learner->id,
        'learner_journal_page_id' => $page->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'title' => 'Earlier note',
        'question' => 'What did you notice before?',
        'reflection' => 'I noticed the parts were connected.',
        'feedback_status' => 'not_requested',
    ]);

    $otherLearner = User::factory()->create();
    $otherPage = LearnerJournalPage::query()->create([
        'user_id' => $otherLearner->id,
        'title' => 'Systems Thinking',
        'topic' => 'Systems Thinking',
        'subtopic' => '',
        'markdown' => 'Someone else’s note',
        'preferred_mode' => 'view',
    ]);
    LearnerReflection::query()->create([
        'user_id' => $otherLearner->id,
        'learner_journal_page_id' => $otherPage->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'title' => 'Someone else’s note',
        'question' => 'What did they notice?',
        'reflection' => 'This must stay private.',
        'feedback_status' => 'not_requested',
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', $activity->learning_node_id))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->has('node.activities.0.reviewContext', 1)
            ->where('node.activities.0.feedbackGuidance.purpose', 'Notice what changed in your understanding.')
            ->where('node.activities.0.reviewContext.0.question', 'What did you notice before?')
            ->where('node.activities.0.reviewContext.0.reflection', 'I noticed the parts were connected.')
        );
});

test('an explicit review activity reuses private comparison context', function () {
    [$learner, $activity] = activeReflectionActivity();
    $activity->forceFill([
        'type' => 'review',
        'config' => [
            'prompt' => 'What do you notice now?',
            'topic' => 'Systems Thinking',
        ],
    ])->save();

    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Systems Thinking',
        'topic' => 'Systems Thinking',
        'subtopic' => '',
        'markdown' => 'Earlier note',
        'preferred_mode' => 'view',
    ]);
    LearnerReflection::query()->create([
        'user_id' => $learner->id,
        'learner_journal_page_id' => $page->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'title' => 'Earlier note',
        'question' => 'What did you notice before?',
        'reflection' => 'I noticed the parts were connected.',
        'feedback_status' => 'not_requested',
    ]);

    $this->actingAs($learner)
        ->get(route('learning.nodes.play', $activity->learning_node_id))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('node.activities.0.type', 'review')
            ->has('node.activities.0.reviewContext', 1)
            ->where('node.activities.0.reviewContext.0.question', 'What did you notice before?')
        );
});

test('the journal includes the learners private check-in trail with a path back to its node', function () {
    [$learner, $activity] = activeReflectionActivity();
    LearnerActivityProgress::query()->create([
        'user_id' => $learner->id,
        'learning_node_id' => $activity->learning_node_id,
        'learning_activity_id' => $activity->id,
        'status' => 'completed',
        'attempt_count' => 1,
        'reached_at' => now()->subMinute(),
        'completed_at' => now()->subMinute(),
        'metadata' => [
            'learningCheckIns' => [
                [
                    'feeling' => 'forming',
                    'recordedAt' => now()->toIso8601String(),
                ],
            ],
        ],
    ]);

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertOk()
        ->assertJsonPath('checkIns.0.activityTitle', 'Notice the pattern')
        ->assertJsonPath('checkIns.0.feeling', 'forming')
        ->assertJsonPath('checkIns.0.nodeTitle', 'Reflection node')
        ->assertJsonPath('checkIns.0.topics.0.slug', 'reflection-practice')
        ->assertJsonPath('checkIns.0.topics.0.name', 'Reflection practice')
        ->assertJsonPath('checkIns.0.activityHref', route('learning.nodes.play', [
            'activity_id' => $activity->id,
            'node' => $activity->node,
        ]))
        ->assertJsonPath('checkIns.0.nodeHref', route('learning.nodes.play', ['node' => $activity->learning_node_id]));
});

test('reflection journal pages keep a path back to their learning place', function () {
    [$learner, $activity, $runId] = activeReflectionActivity();
    $area = LearningTopicArea::query()->create([
        'slug' => 'human-sciences',
        'title' => 'Human sciences',
        'sort_order' => 10,
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'learning-science',
        'title' => 'Learning science',
        'is_published' => true,
    ]);
    $activity->node->map()->update(['learning_topic_id' => $topic->id]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'I can see how the ideas connect.',
        ])
        ->assertOk();

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertOk()
        ->assertJsonPath('pages.0.learningContext.activityTitle', 'Notice the pattern')
        ->assertJsonPath('pages.0.learningContext.nodeTitle', 'Reflection node')
        ->assertJsonPath('pages.0.learningContext.mapTitle', 'Journal map')
        ->assertJsonPath('pages.0.learningContext.topic.title', 'Learning science')
        ->assertJsonPath('pages.0.learningContext.topic.href', route('topics.show', $topic, false))
        ->assertJsonPath('pages.0.learningContext.activityHref', route('learning.nodes.play', [
            'activity_id' => $activity->id,
            'node' => $activity->node,
        ], false))
        ->assertJsonPath('pages.0.learningContext.mapHref', route('world', [
            'focused' => $activity->node->slug,
            'map' => $activity->node->map->slug,
        ], false));
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

test('activity reflections stay private even when journal review requests are enabled', function () {
    [$learner, $activity, $runId] = activeReflectionActivity();
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => true]);

    $this->actingAs($learner)
        ->postJson(route('learning.activities.reflection.store', $activity), [
            'play_run_id' => $runId,
            'reflection' => 'A private observation.',
            'request_expert_access' => true,
        ])
        ->assertOk();

    expect(LearnerReflection::query()->firstOrFail()->expert_access_requested)->toBeFalse()
        ->and(LearnerReflection::query()->firstOrFail()->feedback_status)->toBe('not_requested')
        ->and(LearnerJournalPage::query()->firstOrFail()->expert_access_requested)->toBeFalse()
        ->and(LearnerJournalFeedbackRequest::query()->count())->toBe(0);
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

test('a learner can save an empty journal page', function () {
    $learner = User::factory()->create();
    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Thinking about Imps',
        'topic' => 'General',
        'subtopic' => '',
        'markdown' => 'A draft that will be cleared.',
        'preferred_mode' => 'edit',
    ]);

    $this->actingAs($learner)
        ->patchJson(route('learning.journal.pages.update', $page), [
            'markdown' => '',
            'preferred_mode' => 'edit',
            'request_expert_access' => false,
            'subtopic' => '',
            'title' => 'Thinking about Imps',
            'topic' => 'General',
        ])
        ->assertOk()
        ->assertJsonPath('page.markdown', '')
        ->assertJsonPath('page.title', 'Thinking about Imps');

    $this->assertDatabaseHas('learner_journal_pages', [
        'id' => $page->id,
        'markdown' => '',
    ]);
});

test('a learner can request review for their own journal page when policy allows it', function () {
    $learner = User::factory()->create();
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => true]);
    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Review me',
        'topic' => 'Field studies',
        'subtopic' => '',
        'markdown' => 'I want another perspective on this page.',
        'preferred_mode' => 'view',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.feedback-request', $page), [
            'domain_key' => 'journal',
        ])
        ->assertOk()
        ->assertJsonPath('page.feedbackRequest.domain.label', 'Journal')
        ->assertJsonPath('page.feedbackRequest.status', 'pending')
        ->assertJsonPath('page.expertAccessRequested', true);

    expect(LearnerJournalFeedbackRequest::query()->count())->toBe(1)
        ->and($page->refresh()->expert_access_requested)->toBeTrue();
});

test('journal feedback request domains include the learners groups and organizations', function () {
    $learner = User::factory()->create();
    $group = LearningGroup::query()->create([
        'name' => 'Design Crew',
        'slug' => 'design-crew',
    ]);
    $group->members()->attach($learner->id, ['joined_at' => now()]);
    $organization = Organization::query()->create([
        'created_by_user_id' => $learner->id,
        'name' => 'Sky Builders',
        'slug' => 'sky-builders',
    ]);
    OrganizationMembership::query()->create([
        'organization_id' => $organization->id,
        'user_id' => $learner->id,
        'role' => OrganizationMembership::ROLE_MEMBER,
        'joined_at' => now(),
    ]);

    $this->actingAs($learner)
        ->getJson(route('learning.journal.index'))
        ->assertOk()
        ->assertJsonPath('feedbackDomains.0.label', 'Journal')
        ->assertJsonFragment([
            'key' => "group:{$group->id}",
            'label' => 'Group: Design Crew',
        ])
        ->assertJsonFragment([
            'key' => "organization:{$organization->id}",
            'label' => 'Organization: Sky Builders',
        ]);
});

test('a learner can attach a group domain to a journal feedback request', function () {
    $learner = User::factory()->create();
    $group = LearningGroup::query()->create([
        'name' => 'Review Circle',
        'slug' => 'review-circle',
    ]);
    $group->members()->attach($learner->id, ['joined_at' => now()]);
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => true]);
    $page = journalPage($learner);

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.feedback-request', $page), [
            'domain_key' => "group:{$group->id}",
        ])
        ->assertOk()
        ->assertJsonPath('page.feedbackRequest.domain.type', 'group')
        ->assertJsonPath('page.feedbackRequest.domain.id', $group->id)
        ->assertJsonPath('page.feedbackRequest.domain.label', 'Group: Review Circle');

    $this->assertDatabaseHas('learner_journal_feedback_requests', [
        'learner_journal_page_id' => $page->id,
        'domain_type' => 'group',
        'domain_id' => $group->id,
        'domain_label' => 'Group: Review Circle',
    ]);
});

test('a learner cannot attach a feedback request to another learners group', function () {
    $learner = User::factory()->create();
    $otherLearner = User::factory()->create();
    $group = LearningGroup::query()->create([
        'name' => 'Private Circle',
        'slug' => 'private-circle',
    ]);
    $group->members()->attach($otherLearner->id, ['joined_at' => now()]);
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => true]);
    $page = journalPage($learner);

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.feedback-request', $page), [
            'domain_key' => "group:{$group->id}",
        ])
        ->assertStatus(422);

    expect(LearnerJournalFeedbackRequest::query()->count())->toBe(0);
});

test('a learner cannot request journal page review when policy is disabled', function () {
    $learner = User::factory()->create();
    PlatformJournalSetting::current()->update(['allow_expert_access_requests' => false]);
    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Private page',
        'topic' => 'Field studies',
        'subtopic' => '',
        'markdown' => 'This remains private.',
        'preferred_mode' => 'view',
    ]);

    $this->actingAs($learner)
        ->postJson(route('learning.journal.pages.feedback-request', $page), [
            'domain_key' => 'journal',
        ])
        ->assertStatus(422);

    expect(LearnerJournalFeedbackRequest::query()->count())->toBe(0)
        ->and($page->refresh()->expert_access_requested)->toBeFalse();
});

test('a learner can delete their own journal page', function () {
    $learner = User::factory()->create();
    $page = LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Delete me',
        'topic' => 'Field studies',
        'subtopic' => '',
        'markdown' => 'This page is no longer needed.',
        'preferred_mode' => 'view',
    ]);

    $this->actingAs($learner)
        ->deleteJson(route('learning.journal.pages.destroy', $page))
        ->assertOk()
        ->assertJsonPath('deletedPageId', $page->id);

    $this->assertDatabaseMissing('learner_journal_pages', [
        'id' => $page->id,
    ]);
});

test('a learner cannot delete another learners journal page', function () {
    $owner = User::factory()->create();
    $otherLearner = User::factory()->create();
    $page = LearnerJournalPage::query()->create([
        'user_id' => $owner->id,
        'title' => 'Keep me',
        'topic' => 'Field studies',
        'subtopic' => '',
        'markdown' => 'This page belongs to someone else.',
        'preferred_mode' => 'view',
    ]);

    $this->actingAs($otherLearner)
        ->deleteJson(route('learning.journal.pages.destroy', $page))
        ->assertNotFound();

    $this->assertDatabaseHas('learner_journal_pages', [
        'id' => $page->id,
    ]);
});

function journalPage(User $learner): LearnerJournalPage
{
    return LearnerJournalPage::query()->create([
        'user_id' => $learner->id,
        'title' => 'Review me',
        'topic' => 'Field studies',
        'subtopic' => '',
        'markdown' => 'I want another perspective on this page.',
        'preferred_mode' => 'view',
    ]);
}

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
        'config' => [
            'competenceTopics' => [[
                'slug' => 'reflection-practice',
                'topic' => 'Reflection practice',
                'weight' => 1,
            ]],
            'prompt' => 'What feels clearer now?',
        ],
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
