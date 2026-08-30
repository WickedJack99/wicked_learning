<?php

namespace App\Learning\Actions;

use App\Models\LearningSourceRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateLearningSourceRecord
{
    /**
     * @param  array{anchor?: string|null, excerpt?: string|null, publishedAt?: string|null, publisher?: string|null, rights?: string|null, title: string, url: string}  $data
     */
    public function handle(User $user, LearningSourceRecord $sourceRecord, array $data): LearningSourceRecord
    {
        return DB::transaction(function () use ($data, $sourceRecord, $user): LearningSourceRecord {
            $sourceRecord->versions()->create([
                'anchor' => $sourceRecord->anchor,
                'changed_by' => $user->id,
                'excerpt' => $sourceRecord->excerpt,
                'published_at' => $sourceRecord->published_at,
                'publisher' => $sourceRecord->publisher,
                'rights' => $sourceRecord->rights,
                'title' => $sourceRecord->title,
                'url' => $sourceRecord->url,
            ]);

            $sourceRecord->update([
                'anchor' => $data['anchor'] ?? null,
                'excerpt' => $data['excerpt'] ?? null,
                'published_at' => $data['publishedAt'] ?? null,
                'publisher' => $data['publisher'] ?? null,
                'rights' => $data['rights'] ?? null,
                'title' => $data['title'],
                'url' => $data['url'],
            ]);

            return $sourceRecord->refresh();
        });
    }
}
