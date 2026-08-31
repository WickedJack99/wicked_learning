<?php

namespace App\Learning\Actions;

use App\Models\LearningActivityTemplate;
use App\Models\LearningActivityTemplateRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RestoreLearningActivityTemplateRevision
{
    public function handle(
        User $user,
        LearningActivityTemplate $template,
        LearningActivityTemplateRevision $revision,
    ): LearningActivityTemplate {
        return DB::transaction(function () use ($revision, $template, $user): LearningActivityTemplate {
            $currentSnapshot = is_array($template->snapshot) ? $template->snapshot : [];
            LearningActivityTemplateRevision::query()->create([
                'created_by_user_id' => $user->id,
                'learning_activity_template_id' => $template->id,
                'name' => $template->name,
                'snapshot' => $currentSnapshot,
                'type' => $template->type,
            ]);

            $template->forceFill([
                'snapshot' => is_array($revision->snapshot) ? $revision->snapshot : [],
                'type' => $revision->type,
            ])->save();

            return $template->refresh()->load('organization:id,name');
        });
    }
}
