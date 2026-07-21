<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

class ConsecutiveMessageRateLimiter
{
    public function assertCanSend(
        HasMany $messages,
        User $user,
        string $errorKey = 'body',
        int $limit = 2,
        int $windowSeconds = 60,
    ): void {
        $latestMessages = $messages
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'user_id', 'created_at']);

        if ($latestMessages->count() < $limit) {
            return;
        }

        if ($latestMessages->contains(fn ($message): bool => $message->user_id !== $user->id)) {
            return;
        }

        $oldestLimitedMessage = $latestMessages->last();

        if ($oldestLimitedMessage?->created_at?->lt(now()->subSeconds($windowSeconds))) {
            return;
        }

        throw ValidationException::withMessages([
            $errorKey => 'Wait for someone else to answer or try again in a minute.',
        ]);
    }
}
