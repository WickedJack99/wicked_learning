<?php

namespace App\Learning\Queries;

use App\Models\LearningGroup;
use App\Models\Organization;
use App\Models\User;

/** Lists the places a learner can attach to a feedback request. */
class LoadFeedbackRequestDomains
{
    /** @return array<int, array{key: string, type: string, id: int|null, label: string}> */
    public function handle(User $user): array
    {
        return [
            [
                'key' => 'journal',
                'type' => 'journal',
                'id' => null,
                'label' => 'Journal',
            ],
            ...$this->groups($user),
            ...$this->organizations($user),
        ];
    }

    /** @return array{key: string, type: string, id: int|null, label: string}|null */
    public function find(User $user, string $key): ?array
    {
        foreach ($this->handle($user) as $domain) {
            if ($domain['key'] === $key) {
                return $domain;
            }
        }

        return null;
    }

    /** @return array<int, array{key: string, type: string, id: int, label: string}> */
    private function groups(User $user): array
    {
        return LearningGroup::query()
            ->whereHas('members', fn ($query) => $query->whereKey($user->id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (LearningGroup $group): array => [
                'key' => "group:{$group->id}",
                'type' => 'group',
                'id' => $group->id,
                'label' => "Group: {$group->name}",
            ])
            ->values()
            ->all();
    }

    /** @return array<int, array{key: string, type: string, id: int, label: string}> */
    private function organizations(User $user): array
    {
        return Organization::query()
            ->whereHas('memberships', fn ($query) => $query->where('user_id', $user->id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Organization $organization): array => [
                'key' => "organization:{$organization->id}",
                'type' => 'organization',
                'id' => $organization->id,
                'label' => "Organization: {$organization->name}",
            ])
            ->values()
            ->all();
    }
}
