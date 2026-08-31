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

test('the learning desk can temporarily hide its secondary rail', function () {
    $learningDesk = file_get_contents(
        resource_path('js/features/home/learning-desk.tsx'),
    );

    expect($learningDesk)
        ->toContain('const [focusView, setFocusView] = useState(false);')
        ->toContain("'home.learning_desk.focus.enter'")
        ->toContain("'home.learning_desk.focus.show_rail'")
        ->toContain('{!focusView ? <LearningDeskRail desk={desk} /> : null}');
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
