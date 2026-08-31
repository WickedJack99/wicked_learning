<?php

namespace App\Learning\Actions;

use App\Models\LearningActivityTemplate;

class DeleteLearningActivityTemplate
{
    public function handle(LearningActivityTemplate $template): void
    {
        $template->delete();
    }
}
