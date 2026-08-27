<?php

namespace App\Learning\Queries;

use App\Models\LearningMessageTopic;
use App\Models\User;

class LoadLearnerMessages
{
    /** @return array<string, mixed> */
    public function handle(LearningMessageTopic $topic, User $user, string $audience = 'peers'): array
    {
        $messages = $topic->messages()->where('audience', $audience);

        return [
            'topic' => [
                'id' => $topic->id,
                'title' => $topic->title,
            ],
            'hasContributed' => (clone $messages)
                ->where('user_id', $user->id)
                ->exists(),
            'messages' => $messages
                ->whereNull('hidden_at')
                ->latest()
                ->limit(12)
                ->get()
                ->shuffle()
                ->values()
                ->map(fn ($message): array => [
                    'id' => $message->id,
                    'body' => $message->body,
                ])
                ->all(),
        ];
    }
}
