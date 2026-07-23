<?php

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\AccessRole;
use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;
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
