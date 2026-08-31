<?php

use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('authenticated learners can open every primary learner surface', function () {
    $user = User::factory()->create();

    $surfaces = [
        ['home', 'home'],
        ['paths.index', 'paths'],
        ['topics.index', 'topics/index'],
        ['competence.index', 'competence/index'],
        ['bookmarks', 'bookmarks'],
        ['organizations.index', 'organizations/index'],
    ];

    foreach ($surfaces as [$routeName, $component]) {
        $this->actingAs($user)
            ->get(route($routeName))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component($component)
                ->where('companion.enabled', true)
                ->where('companion.context.surface', 'desk'));
    }
});

test('settings does not receive the learner companion shared prop', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('settings.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->missing('companion'));
});

test('document surfaces keep the shared learner header outside their scroll region', function () {
    $surface = file_get_contents(
        resource_path('js/components/learner-document-surface.tsx'),
    );
    $competence = file_get_contents(
        resource_path('js/pages/competence/index.tsx'),
    );

    expect($surface)
        ->toContain('<LearningDeskHeader />')
        ->toContain("'learner-scroll-pane'")
        ->toContain("'flex min-h-svh min-w-0 flex-col overflow-hidden");
    expect($competence)
        ->toContain(
            'className="flex min-h-svh min-w-0 flex-col overflow-hidden',
        )
        ->toContain(
            'className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden',
        );
});

test('the learning desk defaults to a useful populated area', function () {
    $learningDesk = file_get_contents(
        resource_path('js/features/home/learning-desk.tsx'),
    );

    expect($learningDesk)
        ->toContain('desk.connections.length > 0')
        ->toContain('desk.currentRoutes.length > 0')
        ->toContain('const initialArea = deskAreaFromUrl() ?? defaultArea;');
});

test('the learning desk remembers its focus view preference locally', function () {
    $learningDesk = file_get_contents(
        resource_path('js/features/home/learning-desk.tsx'),
    );

    expect($learningDesk)
        ->toContain('wicked-learning:desk-focus-view:${auth.user.id}')
        ->toContain('readFocusViewPreference(focusPreferenceKey)')
        ->toContain('writeFocusViewPreference(focusPreferenceKey, nextFocusView)')
        ->toContain("'home.learning_desk.focus.enter'")
        ->toContain("'home.learning_desk.focus.show_rail'")
        ->toContain('{!focusView ? <LearningDeskRail desk={desk} /> : null}');
});

test('the learning desk offers a bounded time budget for guided routes', function () {
    $learningDesk = file_get_contents(
        resource_path('js/features/home/learning-desk.tsx'),
    );

    expect($learningDesk)
        ->toContain("type DeskTimeBudget = 'any' | 15 | 30;")
        ->toContain('fitsDeskFilters(')
        ->toContain("'home.learning_desk.purpose_filter.label'")
        ->toContain("'home.learning_desk.time_budget.helper'")
        ->toContain('items={visibleCurrentRoutes}');
});

test('the learning desk remembers explicit planning choices locally', function () {
    $learningDesk = file_get_contents(
        resource_path('js/features/home/learning-desk.tsx'),
    );

    expect($learningDesk)
        ->toContain('wicked-learning:desk-planning:${auth.user.id}')
        ->toContain('readDeskPlanningPreference(planningPreferenceKey)')
        ->toContain('writeDeskPlanningPreference(planningPreferenceKey')
        ->toContain('clearDeskPlanningPreference(planningPreferenceKey)')
        ->toContain("'home.learning_desk.planning.saved_locally'")
        ->toContain("'home.learning_desk.planning.clear'");
});

test('node route choices use pagination instead of a growing scroll region', function () {
    $activityPanel = file_get_contents(
        resource_path('js/features/world/activity-panel.tsx'),
    );

    expect($activityPanel)
        ->toContain('const ROUTE_PAGE_SIZE = 3;')
        ->toContain('const visibleRoutes = routes.slice(')
        ->toContain('<PaginationControls')
        ->not->toContain('route-options-scroll');
});

test('activity orientation copy uses the platform translation catalog', function () {
    $activityPanel = file_get_contents(
        resource_path('js/features/world/activity-panel.tsx'),
    );
    $activityPage = file_get_contents(
        resource_path('js/pages/learning/node-play.tsx'),
    );

    expect($activityPanel)
        ->toContain('usePlatformTranslation()')
        ->toContain("'learning.map.completed_count'")
        ->toContain("'learning.activity.related_areas'")
        ->toContain('<ActivityEvidenceContext')
        ->toContain("'learning.activity.evidence_context.title'")
        ->not->toContain("return 'In progress';");
    expect($activityPage)
        ->toContain("'learning.activity.context.aria_label'")
        ->toContain("'learning.activity.bookmark.add'")
        ->toContain("'learning.activity.back_to_map'")
        ->not->toContain('aria-label="Learning context"');
});

test('activity conclusions repeat authored learning focus as context', function () {
    $checkIn = file_get_contents(
        resource_path('js/features/world/learning-check-in.tsx'),
    );
    $activityPage = file_get_contents(
        resource_path('js/pages/learning/node-play.tsx'),
    );

    expect($checkIn)
        ->toContain('evidenceContext: LearningEvidenceContext;')
        ->toContain('<ActivityEvidenceContext')
        ->toContain("'learning.activity.conclusion.learning_focus_description'")
        ->toContain('not a grade');
    expect($activityPage)
        ->toContain('evidenceContext: activity.evidenceContext')
        ->toContain('pendingLearningCheckIn.evidenceContext');
});

test('activity conclusion copy uses the platform translation catalog', function () {
    $checkIn = file_get_contents(
        resource_path('js/features/world/learning-check-in.tsx'),
    );

    expect($checkIn)
        ->toContain("'learning.activity.check_in.title'")
        ->toContain("'learning.activity.check_in.feeling.clearer.label'")
        ->toContain("'learning.activity.check_in.direction.revisit.label'")
        ->toContain("'learning.activity.check_in.save_error'")
        ->not->toContain('A small pause after {activityTitle}');
});

test('reflection and review activity copy uses the platform translation catalog', function () {
    $activities = file_get_contents(
        resource_path('js/features/world/standard-activities.tsx'),
    );

    expect($activities)
        ->toContain("'learning.reflection.review_kind'")
        ->toContain("'learning.reflection.review_orientation'")
        ->toContain("'learning.reflection.save_review'")
        ->toContain("'learning.reflection.keep_reflection'")
        ->not->toContain("{isReview ? 'Review / revisit' : 'Reflection'}")
        ->not->toContain("{isReview ? 'Save review note' : 'Keep reflection'}");
});

test('NPC dialogue playback copy uses the platform translation catalog', function () {
    $dialogue = file_get_contents(
        resource_path('js/features/world/npc-dialogue-player.tsx'),
    );

    expect($dialogue)
        ->toContain("'learning.npc_dialogue.no_start_path'")
        ->toContain("'learning.npc_dialogue.reflection_placeholder'")
        ->toContain("'learning.npc_dialogue.confirm_answer'")
        ->toContain("'learning.npc_dialogue.keyboard_hint'")
        ->not->toContain('aria-label="Previous dialogue"')
        ->not->toContain('aria-label="Next dialogue"');
});

test('question playback copy uses the platform translation catalog', function () {
    $activities = file_get_contents(
        resource_path('js/features/world/standard-activities.tsx'),
    );

    expect($activities)
        ->toContain("'learning.question.confidence_before_label'")
        ->toContain("'learning.question.recall_keep'")
        ->toContain("'learning.question.earlier_tries'")
        ->toContain("'learning.question.check_answers'")
        ->not->toContain("{isSubmitting ? 'Checking...' : 'Check answers'}")
        ->not->toContain("? 'Remove from recall queue'");
});

test('obstacle playback copy uses the platform translation catalog', function () {
    $obstacle = file_get_contents(
        resource_path('js/features/world/obstacle-activity.tsx'),
    );

    expect($obstacle)
        ->toContain("'learning.obstacle.prompt'")
        ->toContain("'learning.obstacle.choose_tool'")
        ->toContain("'learning.obstacle.tool_not_useful'")
        ->toContain("'learning.obstacle.use_tool'")
        ->toContain("'learning.obstacle.target_fallback'")
        ->not->toContain('aria-label="Use an equipped tool on the gate"');
});

test('markdown playback copy uses the platform translation catalog', function () {
    $markdown = file_get_contents(
        resource_path('js/features/world/markdown-activity.tsx'),
    );

    expect($markdown)
        ->toContain("'learning.markdown.empty.title'")
        ->toContain("'learning.markdown.empty.body'")
        ->toContain("'learning.markdown.previous_page'")
        ->toContain("t('common.continue', 'Continue')")
        ->not->toContain('aria-label="Previous page"');
});

test('item obstacle playback copy uses the platform translation catalog', function () {
    $itemObstacle = file_get_contents(
        resource_path('js/features/world/item-obstacle-activity.tsx'),
    );

    expect($itemObstacle)
        ->toContain("'learning.item_obstacle.item_not_accepted'")
        ->toContain("'learning.item_obstacle.not_ready'")
        ->toContain("'learning.item_obstacle.locked_until'")
        ->toContain("t('common.continue', 'Continue')")
        ->not->toContain('Locked until {lockedUntil?.toLocaleString()}.');
});

test('activity context exposes bounded alternative routes without a scroll region', function () {
    $activityPage = file_get_contents(
        resource_path('js/pages/learning/node-play.tsx'),
    );

    expect($activityPage)
        ->toContain('const ROUTE_ALTERNATIVE_PAGE_SIZE = 3;')
        ->toContain('const visibleAlternativeRoutes = alternativeRoutes.slice(')
        ->toContain("'learning.activity.routes.title'")
        ->toContain('href={`/learning/nodes/${node.id}/play?route=${route.id}`}')
        ->toContain('Your current route remains saved')
        ->toContain('<PaginationControls')
        ->not->toContain('alternative-routes-scroll');
});

test('learner activity actions preserve authored transition labels', function () {
    $activityUtils = file_get_contents(
        resource_path('js/features/world/activity-utils.tsx'),
    );
    $activityComponents = file_get_contents(
        resource_path('js/features/world/standard-activities.tsx'),
    );
    $markdownActivity = file_get_contents(
        resource_path('js/features/world/markdown-activity.tsx'),
    );
    $obstacleActivity = file_get_contents(
        resource_path('js/features/world/obstacle-activity.tsx'),
    );
    $npcDialogue = file_get_contents(
        resource_path('js/features/world/npc-dialogue-player.tsx'),
    );

    expect($activityUtils)
        ->toContain('function activityTransitionLabel(')
        ->toContain('return label || fallback;');
    expect($activityComponents)
        ->toContain("activityTransitionLabel(transition, 'Continue')")
        ->toContain('activityTransitionLabel(')
        ->toContain('isInputPortal ? \'Continue\' : \'Traverse\'')
        ->toContain('nextTransitionLabel')
        ->toContain('answerTransitionLabel');
    expect($markdownActivity)
        ->toContain("t('common.continue', 'Continue')");
    expect($obstacleActivity)
        ->toContain("t('common.continue', 'Continue')");
    expect($npcDialogue)
        ->toContain('npcExitTransition(activity, nextNode.id)')
        ->toContain('transitionLabel: exitTransition?.label');
    expect(file_get_contents(base_path('lang/en.json')))
        ->toContain('"learning.activity.conclusion.next_step": "Next step"');
});

test('learner group chats paginate distinct groups instead of scrolling the group list', function () {
    $groupControl = file_get_contents(
        resource_path('js/features/world/group-control.tsx'),
    );

    expect($groupControl)
        ->toContain('getJson<LearningGroupsResponse>')
        ->toContain('setVisibleGroups(response.groups)')
        ->toContain('<PaginationControls')
        ->not->toContain('min-h-0 overflow-y-auto');
});

test('shared task cooperation areas switch instead of stacking every workflow', function () {
    $sharedTask = file_get_contents(
        resource_path('js/features/world/shared-task-activity.tsx'),
    );

    expect($sharedTask)
        ->toContain('<SharedTaskAreaSwitcher')
        ->toContain("type SharedTaskArea = 'contribute' | 'contributions' | 'peer_review';")
        ->toContain("activeArea === 'contributions'")
        ->toContain("activeArea === 'peer_review'")
        ->toContain('aria-pressed={active}')
        ->toContain("'activities.shared_task.area_navigation'");
});

test('an authenticated learner can open a published topic detail surface', function () {
    $user = User::factory()->create();
    $area = LearningTopicArea::query()->create([
        'slug' => 'navigation-area',
        'title' => 'Navigation area',
        'sort_order' => 10,
    ]);
    $topic = LearningTopic::query()->create([
        'learning_topic_area_id' => $area->id,
        'slug' => 'navigation-topic',
        'title' => 'Navigation topic',
        'is_published' => true,
    ]);

    $this->actingAs($user)
        ->get(route('topics.show', $topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('topics/show')
            ->where('topic.slug', $topic->slug)
            ->where('topic.area.slug', $area->slug)
            ->where('topic.parent', null));
});
