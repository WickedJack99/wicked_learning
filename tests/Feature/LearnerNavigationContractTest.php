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
                ->component($component));
    }
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
