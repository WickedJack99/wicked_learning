<?php

use App\Models\PlatformFeedback;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('an authenticated learner can share platform feedback', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('feedback.store'), [
            'category' => 'idea',
            'message' => 'The topic navigation helped me find a useful next step.',
        ])
        ->assertRedirect(route('feedback.index'));

    $this->assertDatabaseHas('platform_feedback', [
        'category' => 'idea',
        'message' => 'The topic navigation helped me find a useful next step.',
        'user_id' => $user->id,
    ]);
});

test('platform feedback requires a meaningful message', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('feedback.index'))
        ->post(route('feedback.store'), [
            'category' => 'general',
            'message' => 'Too short',
        ])
        ->assertSessionHasErrors('message');

    expect(PlatformFeedback::query()->count())->toBe(0);
});

test('feedback invitations are shared once per session and can be declined permanently', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', true));

    $this->actingAs($user)
        ->get(route('paths.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', false));

    $this->actingAs($user)
        ->patch(route('settings.feedback-prompt.update'), ['action' => 'decline'])
        ->assertRedirect();

    $this->assertDatabaseHas('user_preferences', [
        'user_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', false));
});

test('feedback invitations can be dismissed for a later return', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', true));

    $this->actingAs($user)
        ->patch(route('settings.feedback-prompt.update'), ['action' => 'dismiss'])
        ->assertRedirect();

    $user->refresh();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', false));

    $this->travel(15)->days();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', true));
});

test('feedback prompt settings can turn a permanent opt-out back on', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('settings.feedback-prompt.update'), ['action' => 'decline'])
        ->assertRedirect();

    $user->refresh();

    $this->actingAs($user)
        ->get(route('settings.index', ['panel' => 'personal', 'personal' => 'feedback']))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('personalSettings.feedbackPromptStatus', 'declined'));

    $this->actingAs($user)
        ->patch(route('settings.feedback-prompt.update'), ['action' => 'enable'])
        ->assertRedirect();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('feedbackPrompt', true));
});

test('only authorized administrators can review platform feedback', function () {
    $learner = User::factory()->create();
    $feedback = PlatformFeedback::factory()->create();

    $this->actingAs($learner)
        ->patch(route('settings.learning-support.platform-feedback.review', $feedback))
        ->assertForbidden();

    expect($feedback->refresh()->reviewed_at)->toBeNull();
});

test('administrators receive a paginated platform feedback review queue', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    PlatformFeedback::factory()->count(9)->create();

    $this->actingAs($admin)
        ->get(route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'platform-feedback',
            'platform_feedback_page' => 2,
        ]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('learningSupportSettings.platformFeedback.pagination.currentPage', 2)
            ->where('learningSupportSettings.platformFeedback.pagination.lastPage', 2)
            ->where('learningSupportSettings.platformFeedback.pagination.total', 9)
            ->has('learningSupportSettings.platformFeedback.items', 1));
});

test('an administrator can mark deliberately shared platform feedback as reviewed', function () {
    $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
    $feedback = PlatformFeedback::factory()->create();

    $this->actingAs($admin)
        ->patch(route('settings.learning-support.platform-feedback.review', $feedback))
        ->assertRedirect();

    expect($feedback->refresh()->reviewed_at)->not->toBeNull();
});
