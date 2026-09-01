<?php

namespace App\Organizations\Queries;

use App\Models\Organization;
use App\Models\OrganizationMessage;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadOrganizationMessages
{
    private const int PAGE_SIZE = 8;

    /**
     * @return LengthAwarePaginator<int, OrganizationMessage>
     */
    public function handle(
        Organization $organization,
        User $viewer,
        int $page = 1,
    ): LengthAwarePaginator {
        $query = $organization->messages()
            ->when(! $viewer->isAdmin(), fn ($query) => $query->whereNull('hidden_at'))
            ->with([
                'hiddenBy:id,name,email',
                'user:id,name,email',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');
        $messages = $query->paginate(
            self::PAGE_SIZE,
            ['*'],
            'messages_page',
            max(1, $page),
        );

        if ($messages->isEmpty()
            && $messages->total() > 0
            && $messages->currentPage() > $messages->lastPage()) {
            return $query->paginate(
                self::PAGE_SIZE,
                ['*'],
                'messages_page',
                $messages->lastPage(),
            );
        }

        return $messages;
    }
}
