<?php

namespace App\Learning\Actions;

use App\Models\LearningGroup;
use App\Models\LearningGroupMessage;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ResolveLearningGroupHelpRequest
{
    public function handle(
        LearningGroup $group,
        LearningGroupMessage $message,
        User $user,
    ): LearningGroupMessage {
        if ($message->learning_group_id !== $group->id) {
            throw ValidationException::withMessages([
                'message' => 'This message does not belong to the group.',
            ]);
        }

        if (! $group->members()->whereKey($user->id)->exists()) {
            throw ValidationException::withMessages([
                'group' => 'You are not a member of this group.',
            ]);
        }

        if (! $message->is_help_request) {
            throw ValidationException::withMessages([
                'message' => 'Only help requests can be marked resolved.',
            ]);
        }

        if ($message->user_id === $user->id) {
            throw ValidationException::withMessages([
                'message' => 'Another group member must resolve this help request.',
            ]);
        }

        if ($message->resolved_at !== null) {
            return $message->load(['user', 'resolvedBy']);
        }

        $message->forceFill([
            'resolved_at' => now(),
            'resolved_by_user_id' => $user->id,
        ])->save();

        return $message->load(['user', 'resolvedBy']);
    }
}
