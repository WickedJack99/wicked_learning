<?php

namespace App\Learning\Serializers;

use App\Models\LearningSourceRecord;

class EditableSourceRecordSerializer
{
    /** @return array<string, mixed> */
    public function serialize(LearningSourceRecord $source): array
    {
        return [
            'anchor' => $source->anchor,
            'excerpt' => $source->excerpt,
            'id' => $source->id,
            'publishedAt' => $source->published_at?->format('Y-m-d'),
            'publisher' => $source->publisher,
            'rights' => $source->rights,
            'title' => $source->title,
            'url' => $source->url,
        ];
    }
}
