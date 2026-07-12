<?php

namespace App\Learning\Actions;

use App\Models\LearningActivity;

class UpdateActivitySpecialGraphLayout
{
    /**
     * @param  array{node: string, position: array{x: int|float, y: int|float}}  $data
     */
    public function handle(LearningActivity $activity, array $data): LearningActivity
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $layoutKey = $this->layoutKeyFor($activity);
        $layout = is_array($config[$layoutKey] ?? null) ? $config[$layoutKey] : [];

        $layout[(string) $data['node']] = [
            'x' => (int) round((float) $data['position']['x']),
            'y' => (int) round((float) $data['position']['y']),
        ];

        $activity->forceFill([
            'config' => [
                ...$config,
                $layoutKey => $layout,
            ],
        ])->save();

        return $activity;
    }

    private function layoutKeyFor(LearningActivity $activity): string
    {
        return match ($activity->type) {
            'markdown' => 'markdownGraphLayout',
            'npc_dialogue' => 'dialogueGraphLayout',
            default => abort(404),
        };
    }
}
