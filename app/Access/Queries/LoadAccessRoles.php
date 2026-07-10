<?php

namespace App\Access\Queries;

use App\Models\AccessRole;
use Illuminate\Database\Eloquent\Collection;

class LoadAccessRoles
{
    /**
     * @return Collection<int, AccessRole>
     */
    public function handle(): Collection
    {
        return AccessRole::query()
            ->with('permissions')
            ->orderByDesc('level')
            ->orderBy('name')
            ->get();
    }
}
