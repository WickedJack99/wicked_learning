<?php

namespace App\Learning\Queries;

use App\Models\LearningSourceRecord;
use Illuminate\Database\Eloquent\Collection;

/** Loads a bounded source catalog for authoring reuse. */
class LoadEditableSourceRecords
{
    private const MAX_RECORDS = 100;

    /** @return Collection<int, LearningSourceRecord> */
    public function handle(): Collection
    {
        return LearningSourceRecord::query()
            ->orderBy('title')
            ->orderBy('id')
            ->limit(self::MAX_RECORDS)
            ->get();
    }
}
