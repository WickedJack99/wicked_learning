<?php

namespace App\Organizations\Queries;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadOrganizations
{
    private const int PAGE_SIZE = 12;

    /**
     * @return LengthAwarePaginator<int, Organization>
     */
    public function handle(User $viewer, int $page = 1): LengthAwarePaginator
    {
        $query = Organization::query()
            ->withCount('memberships')
            ->with([
                'memberships' => fn ($query) => $query->where('user_id', $viewer->id),
                'joinRequests' => fn ($query) => $query->where('user_id', $viewer->id),
            ])
            ->orderBy('name')
            ->orderBy('id');
        $organizations = $query->paginate(
            self::PAGE_SIZE,
            ['*'],
            'organization_page',
            max(1, $page),
        );

        if ($organizations->isEmpty()
            && $organizations->total() > 0
            && $organizations->currentPage() > $organizations->lastPage()) {
            return $query->paginate(
                self::PAGE_SIZE,
                ['*'],
                'organization_page',
                $organizations->lastPage(),
            );
        }

        return $organizations;
    }
}
