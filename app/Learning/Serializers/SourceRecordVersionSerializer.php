<?php

namespace App\Learning\Serializers;

use App\Models\LearningSourceRecordVersion;

class SourceRecordVersionSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningSourceRecordVersion $version): array
    {
        return [
            'anchor' => $version->anchor,
            'concepts' => array_values($version->concepts ?? []),
            'excerpt' => $version->excerpt,
            'id' => $version->id,
            'publishedAt' => $version->published_at?->format('Y-m-d'),
            'publisher' => $version->publisher,
            'rights' => $version->rights,
            'title' => $version->title,
            'url' => $version->url,
            'createdAt' => $version->created_at?->toIso8601String(),
        ];
    }
}
