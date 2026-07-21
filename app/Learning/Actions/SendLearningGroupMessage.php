<?php

namespace App\Learning\Actions;

use App\Models\LearningGroup;
use App\Models\LearningGroupMessage;
use App\Models\User;
use App\Support\ConsecutiveMessageRateLimiter;
use Illuminate\Validation\ValidationException;

class SendLearningGroupMessage
{
    public function __construct(private readonly ConsecutiveMessageRateLimiter $rateLimiter) {}

    public function handle(LearningGroup $group, User $user, string $body): LearningGroupMessage
    {
        if (! $this->isMember($group, $user)) {
            throw ValidationException::withMessages([
                'group' => 'You are not a member of this group.',
            ]);
        }

        $this->rateLimiter->assertCanSend($group->messages(), $user);

        return $group->messages()->create([
            'user_id' => $user->id,
            'body' => trim($body),
        ])->load('user');
    }

    private function isMember(LearningGroup $group, User $user): bool
    {
        return $group->members()->whereKey($user->id)->exists();
    }
}
