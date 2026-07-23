<?php

use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearnerRouteProgress;
use App\Models\LearningActivity;
use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\Organization;
use App\Models\OrganizationMembership;
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
