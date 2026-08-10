<?php

namespace App\Learning\Actions;

use App\Models\LearningMapAsset;

class DeleteLearningMapAsset
{
    public function handle(LearningMapAsset $asset): void
    {
        $asset->delete();
    }
}
