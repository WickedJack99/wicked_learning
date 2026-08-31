<?php

namespace App\Learning\Actions;

use App\Models\LearningActivityTemplate;

class UpdateLearningActivityTemplate
{
    public function handle(
        LearningActivityTemplate $template,
        string $name,
    ): LearningActivityTemplate {
        $template->update([
            'name' => trim($name),
        ]);

        return $template->refresh();
    }
}
