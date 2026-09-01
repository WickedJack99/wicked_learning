<?php

namespace App\Organizations\Queries;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadOrganizationMembers
{
    private const int PAGE_SIZE = 8;

    /**
     * @return LengthAwarePaginator<int, OrganizationMembership>
     */
    public function handle(Organization $organization, int $page = 1): LengthAwarePaginator
    {
        $query = $organization->memberships()
            ->with('user:id,name,email')
            ->orderBy('id');
        $members = $query->paginate(
            self::PAGE_SIZE,
            ['*'],
            'members_page',
            max(1, $page),
        );

        if ($members->isEmpty()
            && $members->total() > 0
            && $members->currentPage() > $members->lastPage()) {
            return $query->paginate(
                self::PAGE_SIZE,
                ['*'],
                'members_page',
                $members->lastPage(),
            );
        }

        return $members;
    }
}
