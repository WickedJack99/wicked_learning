<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadAdminLearningGroups;
use App\Models\AccessRole;
use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

test('a scoped teacher can create groups and maps but cannot manage members without permission', function () {
    $teacher = userWithRole('teacher', [
        PermissionCatalog::GROUPS => [AccessLevel::UPDATE, AccessScope::OWN],
        PermissionCatalog::WORLD_MAPS => [AccessLevel::DELETE, AccessScope::OWN],
    ]);
    $world = LearningWorld::query()->create([
        'title' => 'Teacher World',
        'slug' => 'demo-learning-world',
    ]);

    $this->actingAs($teacher)
        ->post(route('settings.groups.store'), [
            'name' => 'Research Circle',
            'study_topic' => 'Local ecosystems',
        ])
        ->assertRedirect(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));

    $group = LearningGroup::query()->where('slug', 'research-circle')->firstOrFail();

    expect($group->created_by_user_id)->toBe($teacher->id)
        ->and($group->study_topic)->toBe('Local ecosystems');

    $this->actingAs($teacher)
        ->patch(route('settings.groups.members.update', $group), [
            'user_ids' => [User::factory()->create()->id],
        ])
        ->assertForbidden();

    $this->actingAs($teacher)
        ->post(route('settings.worlds.maps.store'), [
            'title' => 'Teacher Harbor',
            'description' => 'A map created by the scoped teacher.',
        ])
        ->assertRedirect(route('settings.worlds.index'));

    $map = LearningMap::query()->where('slug', 'teacher-harbor')->firstOrFail();

    expect($map->learning_world_id)->toBe($world->id)
        ->and($map->created_by_user_id)->toBe($teacher->id);
});

test('own scoped map deletion does not allow deleting another users map', function () {
    $teacher = userWithRole('teacher', [
        PermissionCatalog::WORLD_MAPS => [AccessLevel::DELETE, AccessScope::OWN],
    ]);
    $otherUser = User::factory()->create();
    $world = LearningWorld::query()->create([
        'title' => 'Scoped World',
        'slug' => 'scoped-world',
    ]);
    $ownMap = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $teacher->id,
        'title' => 'Own Map',
        'slug' => 'own-map',
    ]);
    $otherMap = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $otherUser->id,
        'title' => 'Other Map',
        'slug' => 'other-map',
    ]);

    $this->actingAs($teacher)
        ->delete(route('settings.worlds.maps.destroy', $otherMap))
        ->assertForbidden();

    $this->actingAs($teacher)
        ->delete(route('settings.worlds.maps.destroy', $ownMap))
        ->assertRedirect(route('settings.worlds.index'));

    expect(LearningMap::query()->whereKey($ownMap->id)->exists())->toBeFalse()
        ->and(LearningMap::query()->whereKey($otherMap->id)->exists())->toBeTrue();
});

test('scoped group readers only hydrate groups in their management scope', function () {
    $manager = userWithRole('group-reader', [
        PermissionCatalog::GROUPS => [AccessLevel::READ, AccessScope::ASSIGNED],
    ]);
    $ownGroup = LearningGroup::query()->create([
        'created_by_user_id' => $manager->id,
        'name' => 'Own group',
        'slug' => 'own-group',
    ]);
    $managedGroup = LearningGroup::query()->create([
        'name' => 'Managed group',
        'slug' => 'managed-group',
    ]);
    $managedGroup->members()->attach($manager->id, [
        'joined_at' => now(),
        'role' => 'manager',
    ]);
    LearningGroup::query()->create([
        'name' => 'Unrelated group',
        'slug' => 'unrelated-group',
    ]);

    expect($ownGroup->refresh()->created_by_user_id)->toBe($manager->id)
        ->and($manager->accessScopeFor(PermissionCatalog::GROUPS, AccessLevel::READ))
        ->toBe(AccessScope::ASSIGNED);

    $groupQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$groupQueries): void {
        if (str_contains($query->sql, 'learning_groups')) {
            $groupQueries[] = $query;
        }
    });

    $response = $this->actingAs($manager)
        ->get(route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('accessGroups', 2)
            ->where('accessGroups.0.name', 'Managed group')
            ->where('accessGroups.1.name', 'Own group'));

    expect($groupQueries)->not->toBeEmpty()
        ->and(collect($groupQueries)->contains(
            fn (QueryExecuted $query): bool => str_contains($query->sql, 'created_by_user_id')
                && str_contains($query->sql, 'learning_group_user'),
        ))->toBeTrue()
        ->and(app(LoadAdminLearningGroups::class)->handle(User::factory()->create()))->toBeEmpty();
});

test('map editor group options and assignments stay within the groups they manage', function () {
    $author = userWithRole('scoped-map-editor', [
        PermissionCatalog::GROUPS => [AccessLevel::UPDATE, AccessScope::ASSIGNED],
        PermissionCatalog::WORLD_MAPS => [AccessLevel::UPDATE, AccessScope::OWN],
        PermissionCatalog::WORLD_MAP_ACCESS => [AccessLevel::UPDATE, AccessScope::OWN],
    ]);
    $world = LearningWorld::query()->create([
        'title' => 'Scoped World',
        'slug' => 'scoped-world',
    ]);
    $map = LearningMap::query()->create([
        'learning_world_id' => $world->id,
        'created_by_user_id' => $author->id,
        'title' => 'Scoped Map',
        'slug' => 'scoped-map',
    ]);
    $ownGroup = LearningGroup::query()->create([
        'created_by_user_id' => $author->id,
        'name' => 'Own group',
        'slug' => 'own-group',
    ]);
    $managedGroup = LearningGroup::query()->create([
        'name' => 'Managed group',
        'slug' => 'managed-group',
    ]);
    $managedGroup->members()->attach($author->id, [
        'joined_at' => now(),
        'role' => 'manager',
    ]);
    $unrelatedGroup = LearningGroup::query()->create([
        'name' => 'Unrelated group',
        'slug' => 'unrelated-group',
    ]);
    $groupQueries = [];
    DB::listen(function (QueryExecuted $query) use (&$groupQueries): void {
        if (str_contains($query->sql, 'learning_groups')) {
            $groupQueries[] = $query;
        }
    });

    $this->actingAs($author)
        ->get(route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('selectedWorldMap.learningGroups.0.name', 'Managed group')
            ->where('selectedWorldMap.learningGroups.1.name', 'Own group')
            ->missing('selectedWorldMap.learningGroups.2'));

    expect(collect($groupQueries)->contains(
        fn (QueryExecuted $query): bool => str_contains($query->sql, 'created_by_user_id')
            && str_contains($query->sql, 'learning_group_user'),
    ))->toBeTrue();

    $this->actingAs($author)
        ->patch(route('settings.worlds.maps.editing-groups.update', $map), [
            'group_ids' => [$unrelatedGroup->id],
        ])
        ->assertForbidden();

    expect($map->editingGroups()->exists())->toBeFalse();

    $this->actingAs($author)
        ->patch(route('settings.worlds.maps.editing-groups.update', $map), [
            'group_ids' => [$ownGroup->id, $managedGroup->id],
        ])
        ->assertRedirect();

    expect($map->editingGroups()->pluck('learning_groups.id')->sort()->values()->all())
        ->toBe(collect([$ownGroup->id, $managedGroup->id])->sort()->values()->all());
});

/**
 * @param  array<string, array{0: string, 1: string}>  $permissions
 */
function userWithRole(string $slug, array $permissions): User
{
    $role = AccessRole::query()->create([
        'slug' => $slug,
        'name' => Str::headline($slug),
        'description' => null,
        'level' => 50,
        'is_system' => false,
    ]);

    foreach (PermissionCatalog::resourceKeys() as $resource) {
        [$level, $scope] = $permissions[$resource] ?? [AccessLevel::NONE, AccessScope::NONE];

        $role->permissions()->create([
            'resource' => $resource,
            'level' => $level,
            'scope' => $scope,
        ]);
    }

    $user = User::factory()->create([
        'role' => $slug,
        'roles' => [$slug],
    ]);
    $user->setAssignedRoles([$slug]);
    $user->save();

    return $user->refresh();
}
