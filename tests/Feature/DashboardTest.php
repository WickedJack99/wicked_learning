<?php

use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\User;
use Database\Seeders\DemoLearningWorldSeeder;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('world'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('world'));
    $response->assertOk();
});

test('authenticated users can visit their bookmark map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();

    LearningNodeBookmark::query()->create([
        'user_id' => $user->id,
        'learning_node_id' => $node->id,
    ]);

    $this->actingAs($user)
        ->get(route('bookmarks'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bookmarks')
            ->where('bookmarkMap.slug', 'bookmarks')
            ->where('bookmarkMap.nodes.0.slug', 'portal-foundation')
            ->where('bookmarkMap.nodes.0.mapSlug', 'first-sector')
            ->where('bookmarkMap.nodes.0.position.q', 0)
            ->where('bookmarkMap.nodes.0.position.r', 0)
        );
});

test('authenticated users can create and remove node bookmarks', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($user)
        ->postJson(route('learning.nodes.bookmark.store', $node))
        ->assertOk()
        ->assertJson([
            'bookmarked' => true,
            'bookmarkedNodeIds' => [$node->id],
        ]);

    expect(LearningNodeBookmark::query()
        ->where('user_id', $user->id)
        ->where('learning_node_id', $node->id)
        ->exists())->toBeTrue();

    $this->actingAs($user)
        ->deleteJson(route('learning.nodes.bookmark.destroy', $node))
        ->assertOk()
        ->assertJson([
            'bookmarked' => false,
            'bookmarkedNodeIds' => [],
        ]);

    expect(LearningNodeBookmark::query()
        ->where('user_id', $user->id)
        ->where('learning_node_id', $node->id)
        ->exists())->toBeFalse();
});

test('authenticated users can search visible maps and nodes', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'archive']))
        ->assertOk()
        ->assertJsonPath('results.0.kind', 'map')
        ->assertJsonPath('results.0.mapSlug', 'signal-archive');

    $this->actingAs($user)
        ->getJson(route('learning.search', ['query' => 'quiet']))
        ->assertOk()
        ->assertJsonFragment([
            'kind' => 'node',
            'nodeSlug' => 'quiet-archive',
        ]);
});

test('world map serializes outgoing portal links for learner travel', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'portal-foundation')->firstOrFail();
    $exitPortal = LearningActivity::query()->create([
        'config' => ['portalMode' => 'input'],
        'learning_node_id' => $node->id,
        'slug' => 'stale-exit-start',
        'type' => 'portal',
        'title' => 'Stale exit start',
        'sort_order' => 999,
    ]);

    LearningActivityStart::query()->create([
        'learning_node_id' => $node->id,
        'learning_activity_id' => $exitPortal->id,
        'label' => null,
        'sort_order' => 999,
    ]);

    $this->actingAs($user)
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('world.maps.0.nodes.0.mapSlug', 'first-sector')
            ->has('world.maps.0.nodes.0.startRoutes', 1)
            ->where('world.maps.0.nodes.0.startRoutes.0.imageDark', '/images/routes/portal-route-dark.svg')
            ->where('world.maps.0.nodes.0.outgoingPortalLinks.0.targetMapSlug', 'signal-archive')
            ->where('world.maps.0.nodes.0.outgoingPortalLinks.0.targetNodeSlug', 'return-gate')
        );
});

test('authenticated users can play a node activity graph outside the map', function () {
    $this->seed(DemoLearningWorldSeeder::class);
    $user = User::factory()->create();
    $node = LearningNode::query()->where('slug', 'signal-gate')->firstOrFail();

    $this->actingAs($user)
        ->get(route('learning.nodes.play', $node))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('node.slug', 'signal-gate')
            ->has('node.activities', 4)
            ->where('node.mapSlug', 'first-sector')
        );
});

test('the old dashboard route redirects to the world map', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('world'));
});
