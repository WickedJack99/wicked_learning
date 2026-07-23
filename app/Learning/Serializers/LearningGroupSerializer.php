<?php

namespace App\Learning\Serializers;

use App\Models\LearningGroup;
use App\Models\LearningGroupMessage;
use App\Models\User;
use DateTimeInterface;

class LearningGroupSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function forLearner(LearningGroup $group, User $user): array
    {
        $group->loadMissing(['members:id,name,email', 'messages.user:id,name,email', 'adminChatVotes']);

        return [
            ...$this->base($group),
            'messages' => $group->messages
                ->sortBy('created_at')
                ->map(fn (LearningGroupMessage $message): array => $this->message($message))
                ->values()
                ->all(),
            'currentUserVotedForAdminChat' => $group->adminChatVotes->contains('user_id', $user->id),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forAdmin(LearningGroup $group): array
    {
        $group->loadMissing(['members:id,name,email', 'messages.user:id,name,email', 'adminChatVotes']);

        return [
            ...$this->base($group),
            'messages' => $group->messages
                ->filter(fn (LearningGroupMessage $message): bool => $group->adminCanViewMessage($message))
                ->sortBy('created_at')
                ->map(fn (LearningGroupMessage $message): array => $this->message($message))
                ->values()
                ->all(),
            'memberIds' => $group->members->pluck('id')->map(fn (int|string $id): int => (int) $id)->values()->all(),
            'voteUserIds' => $group->adminChatVotes->pluck('user_id')->map(fn (int|string $id): int => (int) $id)->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function option(LearningGroup $group): array
    {
        return [
            'id' => $group->id,
            'name' => $group->name,
            'slug' => $group->slug,
            'description' => $group->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function base(LearningGroup $group): array
    {
        $memberCount = $group->members->count();
        $voteCount = $group->adminChatVotes->count();

        return [
            'id' => $group->id,
            'name' => $group->name,
            'slug' => $group->slug,
            'description' => $group->description,
            'studyTopic' => $group->study_topic,
            'members' => $group->members
                ->map(fn (User $member): array => $this->user($member))
                ->values()
                ->all(),
            'memberCount' => $memberCount,
            'adminChatVisible' => $group->admin_chat_visible_enabled,
            'adminChatVisibleUntil' => $this->date($group->admin_chat_visible_until),
            'adminChatVoteCount' => $voteCount,
            'adminChatRequiredVotes' => intdiv($memberCount, 2) + 1,
        ];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function message(LearningGroupMessage $message): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'createdAt' => $this->date($message->created_at),
            'user' => $message->user ? $this->user($message->user) : null,
        ];
    }

    private function date(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
