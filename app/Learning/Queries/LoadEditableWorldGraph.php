<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Models\LearningWorld;

class LoadEditableWorldGraph
{
    public function __construct(private readonly CurrentWorldResolver $worldResolver) {}

    public function handle(): LearningWorld
    {
        return $this->worldResolver
            ->query()
            ->with(['maps.nodes'])
            ->firstOrFail();
    }
}
