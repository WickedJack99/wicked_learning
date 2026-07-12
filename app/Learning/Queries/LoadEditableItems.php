<?php

namespace App\Learning\Queries;

use App\Models\LearningItem;
use Illuminate\Database\Eloquent\Collection;

class LoadEditableItems
{
    /**
     * @return Collection<int, LearningItem>
     */
    public function handle(): Collection
    {
        return LearningItem::query()
            ->orderBy('title')
            ->orderBy('id')
            ->get();
    }
}
