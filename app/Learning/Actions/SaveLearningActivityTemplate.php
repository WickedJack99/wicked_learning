<?php

namespace App\Learning\Actions;

use App\Learning\Services\CaptureLearningActivityTemplateSnapshot;
use App\Models\LearningActivity;
use App\Models\LearningActivityTemplate;
use App\Models\LearningActivityTemplateRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SaveLearningActivityTemplate
{
    public function __construct(private readonly CaptureLearningActivityTemplateSnapshot $snapshot) {}

    public function handle(
        User $user,
        LearningActivity $activity,
        string $name,
    ): LearningActivityTemplate {
        return DB::transaction(function () use ($activity, $name, $user): LearningActivityTemplate {
            $values = $this->snapshot->values($activity);
            $template = LearningActivityTemplate::query()->create([
                'created_by_user_id' => $user->id,
                'name' => trim($name),
                ...$values,
            ]);

            $this->recordRevision($template, $user, $values);

            return $template;
        });
    }

    /** @param array{type: string, snapshot: array<string, mixed>} $values */
    private function recordRevision(
        LearningActivityTemplate $template,
        User $user,
        array $values,
    ): void {
        LearningActivityTemplateRevision::query()->create([
            'created_by_user_id' => $user->id,
            'learning_activity_template_id' => $template->id,
            'name' => $template->name,
            ...$values,
        ]);
    }
}
