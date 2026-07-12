<?php

namespace App\Learning\Services;

use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class LearningMapAccessService
{
    public const PUBLIC_GROUP = 'public';

    /**
     * @return list<string>
     */
    public function defaultAccessRoles(): array
    {
        return [User::ROLE_USER, User::ROLE_ADMIN];
    }

    /**
     * @return list<string>
     */
    public function rolesForMap(LearningMap $map): array
    {
        $roles = is_array($map->access_roles) ? $map->access_roles : [];
        $normalized = $this->normalizeRoles($roles);

        return $normalized === [] ? $this->defaultAccessRoles() : $normalized;
    }

    public function canViewMap(LearningMap $map, ?User $user): bool
    {
        $allowedRoles = $this->rolesForMap($map);

        if (in_array(self::PUBLIC_GROUP, $allowedRoles, true)) {
            return true;
        }

        if (! $user) {
            return false;
        }

        return array_intersect($allowedRoles, $user->assignedRoles()) !== [];
    }

    /**
     * @param  EloquentCollection<int, LearningMap>|Collection<int, LearningMap>  $maps
     * @return Collection<int, LearningMap>
     */
    public function visibleMaps(EloquentCollection|Collection $maps, ?User $user): Collection
    {
        return $maps
            ->filter(fn (LearningMap $map): bool => $this->canViewMap($map, $user))
            ->values();
    }

    /**
     * @param  array<int, mixed>  $roles
     * @return list<string>
     */
    public function normalizeRoles(array $roles): array
    {
        return array_values(array_unique(array_filter(
            array_map(
                fn (mixed $role): string => is_string($role) ? trim($role) : '',
                $roles,
            ),
            fn (string $role): bool => $role !== '',
        )));
    }
}
