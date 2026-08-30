<?php

namespace App\Learning\Queries;

use App\Models\LearningMessageTopic;

class LoadLearnerMessageModeration
{
    /** @return array<int, array<string, mixed>> */
    public function handle(): array
    {
        return LearningMessageTopic::query()
            ->with([
                'mapAsset.map:id,title',
                'mapAsset.node:id,title',
                'messages.author:id,name,email',
                'messages.hiddenBy:id,name,email',
                'messages.responses.author:id,name,email',
                'messages.responses.hiddenBy:id,name,email',
            ])
            ->whereHas('messages')
            ->orderBy('title')
            ->get()
            ->map(fn (LearningMessageTopic $topic): array => [
                'id' => $topic->id,
                'title' => $topic->title,
                'mapAsset' => [
                    'id' => $topic->mapAsset->id,
                    'title' => $topic->mapAsset->node?->title
                        ?: $topic->mapAsset->text
                        ?: "MapAsset {$topic->mapAsset->id}",
                    'mapTitle' => $topic->mapAsset->map->title,
                ],
                'messages' => $topic->messages->map(fn ($message): array => [
                    'id' => $message->id,
                    'audience' => $message->audience,
                    'body' => $message->body,
                    'createdAt' => $message->created_at?->toIso8601String(),
                    'hiddenAt' => $message->hidden_at?->toIso8601String(),
                    'author' => [
                        'id' => $message->author->id,
                        'name' => $message->author->name,
                        'email' => $message->author->email,
                    ],
                    'hiddenBy' => $message->hiddenBy ? [
                        'id' => $message->hiddenBy->id,
                        'name' => $message->hiddenBy->name,
                    ] : null,
                    'responses' => $message->responses->map(fn ($response): array => [
                        'id' => $response->id,
                        'body' => $response->body,
                        'responseType' => $response->response_type,
                        'isHelpful' => $response->helpful_at !== null,
                        'createdAt' => $response->created_at?->toIso8601String(),
                        'hiddenAt' => $response->hidden_at?->toIso8601String(),
                        'author' => [
                            'id' => $response->author->id,
                            'name' => $response->author->name,
                            'email' => $response->author->email,
                        ],
                        'hiddenBy' => $response->hiddenBy ? [
                            'id' => $response->hiddenBy->id,
                            'name' => $response->hiddenBy->name,
                        ] : null,
                    ])->values()->all(),
                ])->values()->all(),
            ])
            ->values()
            ->all();
    }
}
