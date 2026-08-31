<?php

namespace App\Learning\Actions;

use App\Models\LearningActivityTemplate;
use App\Models\Organization;

class ShareLearningActivityTemplate
{
    public function handle(
        LearningActivityTemplate $template,
        ?Organization $organization,
    ): LearningActivityTemplate {
        $template->forceFill([
            'organization_id' => $organization?->id,
        ])->save();

        return $template->refresh()->load('organization:id,name');
    }
}
