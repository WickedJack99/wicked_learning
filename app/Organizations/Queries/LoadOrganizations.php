<?php

namespace App\Organizations\Queries;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class LoadOrganizations
{
    /**
     * @return Collection<int, Organization>
     */
    public function handle(User $viewer): Collection
    {
        return Organization::query()
            ->withCount('memberships')
            ->with([
                'memberships' => fn ($query) => $query->where('user_id', $viewer->id),
                'joinRequests' => fn ($query) => $query->where('user_id', $viewer->id),
            ])
            ->orderBy('name')
            ->get();
    }
}
