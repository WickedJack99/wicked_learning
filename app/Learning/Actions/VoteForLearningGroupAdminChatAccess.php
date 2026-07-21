<?php

namespace App\Learning\Actions;

use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoteForLearningGroupAdminChatAccess
{
    public function handle(LearningGroup $group, User $user): LearningGroup
    {
        return DB::transaction(function () use ($group, $user): LearningGroup {
            $memberCount = $group->members()->count();

            if ($memberCount < 1 || ! $group->members()->whereKey($user->id)->exists()) {
                throw ValidationException::withMessages([
                    'group' => 'You are not a member of this group.',
                ]);
            }

            $group->adminChatVotes()->firstOrCreate([
                'user_id' => $user->id,
            ]);

            if ($group->adminChatVotes()->count() >= $this->requiredVotes($memberCount)) {
                $group->forceFill([
                    'admin_chat_visible_enabled' => true,
                    'admin_chat_visible_until' => null,
                ])->save();
            }

            return $group->refresh()->load(['members', 'messages.user', 'adminChatVotes']);
        });
    }

    private function requiredVotes(int $memberCount): int
    {
        return intdiv($memberCount, 2) + 1;
    }
}
