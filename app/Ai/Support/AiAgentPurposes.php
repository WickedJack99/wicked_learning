<?php

namespace App\Ai\Support;

class AiAgentPurposes
{
    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return [
            [
                'value' => 'sdt_design',
                'label' => 'SDT design helper',
                'description' => 'Helps admins review learning flows for autonomy, competence and relatedness.',
            ],
            [
                'value' => 'asset_generation',
                'label' => 'Asset generation helper',
                'description' => 'Drafts prompts or asset ideas for worlds, tiles and activity scenes.',
            ],
            [
                'value' => 'learner_feedback',
                'label' => 'Learner feedback helper',
                'description' => 'Prepares informational feedback for reflections without scores or pressure loops.',
            ],
            [
                'value' => 'general_assistant',
                'label' => 'General assistant',
                'description' => 'A broader helper for tasks that do not need sensitive learner context.',
            ],
            [
                'value' => 'content_authoring',
                'label' => 'Content authoring',
                'description' => 'Drafts reviewable MapAssets and short Activity routes for administrators.',
            ],
            [
                'value' => 'activity_review',
                'label' => 'Activity review',
                'description' => 'Reviews one activity in its scoped learning context for clarity and learning support.',
            ],
        ];
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::options(), 'value');
    }
}
