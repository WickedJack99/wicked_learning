<?php

namespace App\Learning\Queries;

use App\Learning\Serializers\LearningGroupSerializer;
use App\Models\LearningGroup;

class LoadLearningGroupOptions
{
    public function __construct(private readonly LearningGroupSerializer $serializer) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function handle(): array
    {
        return LearningGroup::query()
            ->orderBy('name')
            ->get()
            ->map(fn (LearningGroup $group): array => $this->serializer->option($group))
            ->all();
    }
}
