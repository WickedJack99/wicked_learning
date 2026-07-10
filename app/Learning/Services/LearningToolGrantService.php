<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class LearningToolGrantService
{
    public function grantFromActivity(User $user, LearningActivity $activity): LearningTool
    {
        abort_unless($activity->type === 'tool_grant', 404);

        $config = is_array($activity->config) ? $activity->config : [];

        return $this->grantConfiguredTool($user, $config);
    }

    public function grantFromNpcDialogueNode(User $user, NpcDialogueNode $node): LearningTool
    {
        abort_unless($node->type === 'npc_interaction', 404);

        $config = is_array($node->config) ? $node->config : [];

        return $this->grantConfiguredTool($user, $config);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function grantConfiguredTool(User $user, array $config): LearningTool
    {
        $toolId = is_numeric($config['toolId'] ?? null) ? (int) $config['toolId'] : 0;

        if ($toolId <= 0) {
            throw ValidationException::withMessages([
                'tool_id' => 'No tool is configured for this moment.',
            ]);
        }

        $tool = LearningTool::query()->find($toolId);

        if (! $tool instanceof LearningTool) {
            throw ValidationException::withMessages([
                'tool_id' => 'The configured tool no longer exists.',
            ]);
        }

        $user->learningTools()->syncWithoutDetaching([
            $tool->id => ['acquired_at' => now()],
        ]);

        return $tool;
    }
}
