<?php

namespace App\Learning\Serializers;

use App\Models\LearningMapLayoutVersion;

class LearningMapLayoutVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningMapLayoutVersion $version): array
    {
        return [
            'createdAt' => $version->created_at?->toIso8601String(),
            'id' => $version->id,
            'nodeCount' => is_array($version->snapshot) ? count($version->snapshot) : 0,
        ];
    }
}
