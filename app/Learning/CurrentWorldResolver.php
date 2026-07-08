<?php

namespace App\Learning;

use App\Models\LearningWorld;
use Illuminate\Database\Eloquent\Builder;

class CurrentWorldResolver
{
    public const DEFAULT_WORLD_SLUG = 'demo-cybersecurity';

    /**
     * Keep the current-world lookup in one place until multi-world routing exists.
     *
     * @return Builder<LearningWorld>
     */
    public function query(): Builder
    {
        return LearningWorld::query()->where('slug', self::DEFAULT_WORLD_SLUG);
    }

    public function resolve(): ?LearningWorld
    {
        return $this->query()->first();
    }

    public function resolveOrFail(): LearningWorld
    {
        return $this->query()->firstOrFail();
    }
}
