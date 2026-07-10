<?php

namespace App\Learning\Queries;

use App\Models\LearningTool;
use Illuminate\Database\Eloquent\Collection;

class LoadEditableTools
{
    /**
     * @return Collection<int, LearningTool>
     */
    public function handle(): Collection
    {
        return LearningTool::query()
            ->orderBy('title')
            ->orderBy('id')
            ->get();
    }
}
