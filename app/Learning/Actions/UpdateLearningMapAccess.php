<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearningMap;

class UpdateLearningMapAccess
{
    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningMap $map, array $data): void
    {
        $roles = $this->mapAccess->normalizeRoles($data['access_roles'] ?? []);

        $map->forceFill([
            'access_roles' => $roles === []
                ? $this->mapAccess->defaultAccessRoles()
                : $roles,
        ])->save();
    }
}
