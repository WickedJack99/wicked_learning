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
    public function handle(User $viewer, int $page = 1, ?string $search = null): LengthAwarePaginator
    {
        $search = trim((string) $search);
        $query = Organization::query()
            ->withCount('memberships')
            ->with([
                'memberships' => fn ($query) => $query->where('user_id', $viewer->id),
                'joinRequests' => fn ($query) => $query->where('user_id', $viewer->id),
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $needle = '%'.mb_strtolower($search).'%';

                $query->where(function ($query) use ($needle): void {
                    $query
                        ->whereRaw('LOWER(name) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(slug) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(COALESCE(slogan, \'\')) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(COALESCE(description, \'\')) LIKE ?', [$needle]);
                });
            })
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
