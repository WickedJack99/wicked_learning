<?php

namespace App\Learning\Actions;

use App\Learning\Services\CaptureLearningActivityTemplateSnapshot;
use App\Models\LearningActivity;
use App\Models\LearningActivityTemplate;
use App\Models\LearningActivityTemplateRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateLearningActivityTemplateSnapshot
{
    public function __construct(private readonly CaptureLearningActivityTemplateSnapshot $snapshot) {}

    public function handle(
        User $user,
        LearningActivityTemplate $template,
        LearningActivity $activity,
    ): LearningActivityTemplate {
        return DB::transaction(function () use ($activity, $template, $user): LearningActivityTemplate {
            $values = $this->snapshot->values($activity);

            LearningActivityTemplateRevision::query()->create([
                'created_by_user_id' => $user->id,
                'learning_activity_template_id' => $template->id,
                'name' => $template->name,
                ...$values,
            ]);

            $template->forceFill($values)->save();

            return $template->refresh()->load('organization:id,name');
        });
    }
}
