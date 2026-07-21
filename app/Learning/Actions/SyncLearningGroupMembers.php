<?php

namespace App\Learning\Actions;

use App\Models\LearningGroup;
use Illuminate\Support\Facades\DB;

class SyncLearningGroupMembers
{
    /**
     * @param  array<int, int|string>  $userIds
     */
    public function handle(LearningGroup $group, array $userIds): LearningGroup
    {
        return DB::transaction(function () use ($group, $userIds): LearningGroup {
            $group->loadMissing('members');

            $now = now();
            $normalizedUserIds = array_values(array_unique(array_map('intval', $userIds)));
            $currentUserIds = $group->members()->pluck('users.id')->map(fn (int|string $id): int => (int) $id)->all();
            $newUserIds = array_diff($normalizedUserIds, $currentUserIds);
            $removedUserIds = array_diff($currentUserIds, $normalizedUserIds);

            $syncPayload = collect($normalizedUserIds)
                ->mapWithKeys(fn (int $userId): array => [
                    $userId => ['joined_at' => in_array($userId, $currentUserIds, true) ? $this->joinedAt($group, $userId) : $now],
                ])
                ->all();

            $group->members()->sync($syncPayload);

            if ($newUserIds !== [] || $removedUserIds !== []) {
                $group->adminChatVotes()->delete();
            }

            if ($newUserIds !== [] && $group->admin_chat_visible_enabled) {
                $group->forceFill([
                    'admin_chat_visible_enabled' => false,
                    'admin_chat_visible_until' => $now,
                ])->save();
            }

            return $group->refresh()->load(['members', 'messages.user', 'adminChatVotes']);
        });
    }

    private function joinedAt(LearningGroup $group, int $userId): ?string
    {
        $joinedAt = DB::table('learning_group_user')
            ->where('learning_group_id', $group->id)
            ->where('user_id', $userId)
            ->value('joined_at');

        return is_string($joinedAt) ? $joinedAt : null;
    }
}
