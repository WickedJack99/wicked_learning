<?php

namespace App\Organizations\Queries;

use App\Models\Organization;
use App\Models\OrganizationJoinRequest;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadOrganizationJoinRequests
{
    private const int PAGE_SIZE = 4;

    /**
     * @return LengthAwarePaginator<int, OrganizationJoinRequest>
     */
    public function handle(Organization $organization, int $page = 1): LengthAwarePaginator
    {
        $query = $organization->joinRequests()
            ->where('status', OrganizationJoinRequest::STATUS_PENDING)
            ->with('requester:id,name,email')
            ->orderBy('id');
        $requests = $query->paginate(
            self::PAGE_SIZE,
            ['*'],
            'join_requests_page',
            max(1, $page),
        );

        if ($requests->isEmpty()
            && $requests->total() > 0
            && $requests->currentPage() > $requests->lastPage()) {
            return $query->paginate(
                self::PAGE_SIZE,
                ['*'],
                'join_requests_page',
                $requests->lastPage(),
            );
        }

        return $requests;
    }
}
