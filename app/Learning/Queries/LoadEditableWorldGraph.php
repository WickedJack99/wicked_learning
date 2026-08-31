<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LoadEditableWorldGraph
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    public function handle(?User $user = null): LearningWorld
    {
        return $this->worldResolver
            ->query()
            ->with([
                'maps' => function (HasMany $query) use ($user): void {
                    if ($user) {
                        $this->mapEditAccess->scopeEditableMaps($query->getQuery(), $user);
                    }

                    $query->with('nodes');
                },
            ])
            ->firstOrFail();
    }
}
