<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\AccessRole;

class LoadLearningMapAccessGroups
{
    /**
     * @return list<array{description: string|null, label: string, slug: string}>
     */
    public function handle(): array
    {
        $roleGroups = AccessRole::query()
            ->where('slug', '!=', LearningMapAccessService::PUBLIC_GROUP)
            ->orderBy('level')
            ->orderBy('name')
            ->get()
            ->map(fn (AccessRole $role): array => [
                'description' => $role->description,
                'label' => $role->name,
                'slug' => $role->slug,
            ])
            ->all();

        return [
            [
                'description' => 'Anyone can visit maps with this group without logging in. Progress is not stored server-side for guests.',
                'label' => 'Public',
                'slug' => LearningMapAccessService::PUBLIC_GROUP,
            ],
            ...$roleGroups,
        ];
    }
}
