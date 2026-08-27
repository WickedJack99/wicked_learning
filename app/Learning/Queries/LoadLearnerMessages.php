<?php

namespace App\Learning\Queries;

use App\Models\LearningMessageTopic;
use App\Models\User;

class LoadLearnerMessages
{
    /** @return array<string, mixed> */
    public function handle(
        LearningMessageTopic $topic,
        User $user,
        string $audience = 'peers',
        bool $allowResponses = false,
    ): array {
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
                ->map(function ($message) use ($allowResponses, $user): array {
                    $responses = $allowResponses
                        ? $message->responses()
                            ->whereNull('hidden_at')
                            ->latest()
                            ->limit(3)
                            ->get()
                            ->reverse()
                            ->values()
                            ->map(fn ($response): array => [
                                'body' => $response->body,
                                'id' => $response->id,
                            ])
                            ->all()
                        : [];

                    return [
                        'body' => $message->body,
                        'canRespond' => $allowResponses && $message->user_id !== $user->id,
                        'hasResponded' => $allowResponses
                            && $message->responses()->where('user_id', $user->id)->exists(),
                        'id' => $message->id,
                        'responses' => $responses,
                    ];
                })
                ->all(),
        ];
    }
}
