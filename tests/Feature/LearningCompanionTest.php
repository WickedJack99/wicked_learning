<?php

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningCompanionConfigurationResolver;
use App\Learning\Validation\LearningCompanionDialogueGraphValidator;
use App\Models\LearningActivity;
use App\Models\LearningCompanionDialogue;
use App\Models\LearningCompanionDialogueAssignment;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformCompanionSetting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;

test('learners receive the companion on the learning desk', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('home')
            ->where('companion.enabled', true)
            ->where('companion.context.surface', 'desk')
            ->has('companion.context.actions', 2)
        );
});

test('learners receive a bounded companion context on the world map', function () {
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Companion World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'companion-map',
        'title' => 'Companion Map',
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('companion.enabled', true)
            ->where('companion.context.surface', 'world')
            ->where('companion.context.world.title', 'Companion World')
            ->where('companion.context.map.id', $map->id)
            ->has('companion.context.actions', 2)
        );
});

test('learners receive the active activity and route in the companion context', function () {
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Activity Companion World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'activity-companion-map',
        'title' => 'Activity Companion Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'companion-place',
        'title' => 'Companion Place',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'orient',
        'type' => 'reflection',
        'title' => 'Orient here',
    ]);
    $node->update(['start_activity_id' => $activity->id]);

    $this->actingAs(User::factory()->create())
        ->get(route('learning.nodes.play', ['node' => $node, 'activity_id' => $activity->id]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('learning/node-play')
            ->where('companion.context.surface', 'activity')
            ->where('companion.context.node.title', 'Companion Place')
            ->where('companion.context.activity.title', 'Orient here')
            ->has('companion.context.actions', 2)
        );
});

test('companion configuration inherits from each learning scope', function () {
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Inherited Companion World',
        'companion_config' => ['display_name' => 'World guide'],
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'inherited-companion-map',
        'title' => 'Inherited Companion Map',
        'companion_config' => [
            'welcome_message' => 'Map-specific orientation.',
            'avatar_color' => '#f59e0b',
        ],
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'inherited-companion-place',
        'title' => 'Inherited Companion Place',
        'position_q' => 0,
        'position_r' => 0,
        'state' => 'available',
        'companion_config' => ['display_name' => 'Place guide'],
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'inherited-orientation',
        'type' => 'reflection',
        'title' => 'Inherited orientation',
        'companion_config' => [
            'mode' => 'guided_ai',
            'ai' => [
                'enabled' => true,
                'capabilities' => ['current-context', 'not-allowed'],
            ],
            'dialogue_graph' => [
                'version' => 1,
                'start' => 'welcome',
                'nodes' => [
                    [
                        'id' => 'welcome',
                        'type' => 'message',
                        'message' => 'Choose a direction when you are ready.',
                        'next' => 'choice',
                    ],
                    [
                        'id' => 'choice',
                        'type' => 'choice',
                        'prompt' => 'Where next?',
                        'choices' => [[
                            'key' => 'map',
                            'label' => 'Return to the map',
                            'action' => 'current-map',
                        ]],
                    ],
                ],
            ],
        ],
    ]);
    $node->update(['start_activity_id' => $activity->id]);
    PlatformCompanionSetting::current()->update(['companion_config' => [
        'display_name' => 'Platform guide',
    ]]);

    $this->actingAs(User::factory()->create())
        ->get(route('learning.nodes.play', ['node' => $node, 'activity_id' => $activity->id]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('companion.displayName', 'Place guide')
            ->where('companion.message', 'Map-specific orientation.')
            ->where('companion.avatarColor', '#f59e0b')
            ->where('companion.configuration.mode', 'guided_ai')
            ->where('companion.configuration.sourceScope', 'activity')
            ->where('companion.configuration.aiEnabled', true)
            ->where('companion.dialogue.version', 1)
            ->where('companion.dialogue.nodes.1.choices.0.action', 'current-map')
        );
});

test('invalid companion graph cannot expose arbitrary navigation', function () {
    expect(fn () => app(LearningCompanionDialogueGraphValidator::class)->validate([
        'version' => 1,
        'start' => 'welcome',
        'nodes' => [[
            'id' => 'welcome',
            'type' => 'choice',
            'prompt' => 'Where next?',
            'choices' => [[
                'key' => 'unsafe',
                'label' => 'Go anywhere',
                'action' => 'https://example.test/admin',
            ]],
        ]],
    ]))->toThrow(ValidationException::class);
});

test('invalid inherited graph is ignored without breaking the learner companion', function () {
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Safe Companion World',
        'companion_config' => [
            'dialogue_graph' => [
                'version' => 1,
                'start' => 'missing',
                'nodes' => [],
            ],
        ],
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'safe-companion-map',
        'title' => 'Safe Companion Map',
    ]);

    $configuration = app(LearningCompanionConfigurationResolver::class)->resolve(
        PlatformCompanionSetting::current(),
        $world,
        $map,
    );

    expect($configuration['dialogue'])->toBeNull();
});

test('admins can configure the scripted companion', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $this->actingAs($admin)
        ->get(route('settings.index', ['panel' => 'admin-learning-companion']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/index')
            ->where('companionSettings.display_name', 'Learning companion')
        );

    $this->actingAs($admin)
        ->patch(route('settings.companion.update'), [
            'enabled' => true,
            'display_name' => 'Mira',
            'avatar_url' => '/storage/companion/mira.png',
            'avatar_color' => '#f59e0b',
            'welcome_message' => 'Take a look around, then choose what calls to you.',
        ])
        ->assertRedirect(route('settings.index', ['panel' => 'admin-learning-companion']));

    expect(PlatformCompanionSetting::current()->only([
        'enabled',
        'display_name',
        'avatar_url',
        'welcome_message',
    ]))->toMatchArray([
        'enabled' => true,
        'display_name' => 'Mira',
        'avatar_url' => '/storage/companion/mira.png',
        'welcome_message' => 'Take a look around, then choose what calls to you.',
    ]);
    expect(PlatformCompanionSetting::current()->companion_config['avatar_color'])->toBe('#f59e0b');
});

test('admins can upload a companion avatar through the reusable media workflow', function () {
    Storage::fake('public');
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);

    $response = $this->actingAs($admin)->postJson(
        route('settings.companion.avatar.store'),
        ['file' => UploadedFile::fake()->image('companion.png')],
    );

    $response
        ->assertOk()
        ->assertJsonStructure(['durationSeconds', 'url']);

    expect(Storage::disk('public')->allFiles('learning/media'))
        ->toHaveCount(1);
});

test('admins can manage paginated companion graphs and assign them to authored pages', function () {
    $admin = User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'roles' => [User::ROLE_ADMIN],
    ]);
    $world = LearningWorld::query()->create([
        'slug' => 'dialogue-world',
        'title' => 'Dialogue World',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'dialogue-map',
        'title' => 'Assignable Map',
    ]);
    $node = LearningNode::query()->create([
        'learning_map_id' => $map->id,
        'slug' => 'dialogue-place',
        'title' => 'Assignable Place',
        'position_q' => 0,
        'position_r' => 0,
    ]);
    $activity = LearningActivity::query()->create([
        'learning_node_id' => $node->id,
        'slug' => 'dialogue-activity',
        'type' => 'reflection',
        'title' => 'Assignable Activity',
    ]);

    $this->actingAs($admin)
        ->postJson(route('settings.companion.dialogues.store'), ['name' => 'First graph'])
        ->assertCreated()
        ->assertJsonPath('name', 'First graph')
        ->assertJsonPath('dialogueGraph.version', 1);

    $this->actingAs($admin)
        ->postJson(route('settings.companion.dialogues.store'), [
            'name' => 'Invalid graph',
            'dialogue_graph' => [
                'version' => 1,
                'start' => 'missing',
                'nodes' => [],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('dialogue_graph');

    $dialogue = LearningCompanionDialogue::query()->firstOrFail();
    $this->actingAs($admin)
        ->postJson(route('settings.companion.dialogues.store'), ['name' => 'Second graph'])
        ->assertCreated();

    $this->actingAs($admin)
        ->getJson(route('settings.companion.dialogues.index').'?page=2&per_page=1')
        ->assertOk()
        ->assertJsonPath('pagination.currentPage', 2)
        ->assertJsonPath('pagination.lastPage', 2)
        ->assertJsonCount(1, 'items');

    $this->actingAs($admin)
        ->putJson(route('settings.companion.dialogues.assignments.update', $dialogue), [
            'assignments' => [
                ['scope_type' => 'map', 'scope_id' => $map->id],
                ['scope_type' => 'node', 'scope_id' => $node->id],
                ['scope_type' => 'activity', 'scope_id' => $activity->id],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('assignmentsCount', 3);

    $this->actingAs($admin)
        ->getJson(route('settings.companion.dialogues.assignments.index', $dialogue).'?search=Assignable%20Map')
        ->assertOk()
        ->assertJsonPath('pagination.total', 1)
        ->assertJsonPath('items.0.selected', true);

    $configuration = app(LearningCompanionConfigurationResolver::class)->resolve(
        PlatformCompanionSetting::current(),
        $world,
        $map,
        $node,
        $activity,
    );

    expect($configuration['dialogue']['version'])->toBe(1)
        ->and(LearningCompanionDialogueAssignment::query()->count())->toBe(3);
});

test('regular users cannot configure the scripted companion', function () {
    $user = User::factory()->create([
        'role' => User::ROLE_USER,
        'roles' => [User::ROLE_USER],
    ]);

    $this->actingAs($user)
        ->patch(route('settings.companion.update'), [
            'enabled' => false,
            'display_name' => 'Not allowed',
            'welcome_message' => 'Not allowed',
        ])
        ->assertForbidden();
});

test('a disabled companion is omitted from learner pages', function () {
    $world = LearningWorld::query()->create([
        'slug' => CurrentWorldResolver::DEFAULT_WORLD_SLUG,
        'title' => 'Disabled Companion World',
    ]);
    LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'slug' => 'disabled-companion-map',
        'title' => 'Disabled Companion Map',
    ]);
    PlatformCompanionSetting::current()->update(['enabled' => false]);

    $this->actingAs(User::factory()->create())
        ->get(route('world'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('world')
            ->where('companion', null)
        );
});
