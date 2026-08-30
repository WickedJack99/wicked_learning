<?php

namespace App\Learning\Queries;

use App\Models\LearnerMessage;
use App\Models\LearningMessageTopic;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadLearnerMessageModeration
{
    /** @return array<int, array<string, mixed>> */
    public function topics(): array
    {
        return LearningMessageTopic::query()
            ->with([
                'mapAsset.map:id,title',
                'mapAsset.node:id,title',
            ])
            ->withCount('messages')
            ->whereHas('messages')
            ->orderBy('title')
            ->get()
            ->map(fn (LearningMessageTopic $topic): array => $this->topicSummary($topic))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function messages(
        LearningMessageTopic $topic,
        int $page = 1,
        int $perPage = 12,
        string $filter = 'all',
    ): array {
        $messages = $topic->messages()
            ->with([
                'author:id,name,email',
                'hiddenBy:id,name,email',
                'responses.author:id,name,email',
                'responses.hiddenBy:id,name,email',
            ])
            ->when(
                $filter === 'helpful',
                fn ($query) => $query->whereHas(
                    'responses',
                    fn ($responseQuery) => $responseQuery->whereNotNull('helpful_at'),
                ),
            )
            ->when(
                $filter === 'unconfirmed',
                fn ($query) => $query->whereDoesntHave(
                    'responses',
                    fn ($responseQuery) => $responseQuery->whereNotNull('helpful_at'),
                ),
            );

        $messagePage = $messages->paginate(
            min(max($perPage, 1), 12),
            ['*'],
            'page',
            max($page, 1),
        );
        $allMessages = $topic->messages();
        $helpfulMessageCount = (clone $allMessages)
            ->whereHas(
                'responses',
                fn ($responseQuery) => $responseQuery->whereNotNull('helpful_at'),
            )
            ->count();
        $messageCount = (clone $allMessages)->count();

        $topic->loadMissing([
            'mapAsset.map:id,title',
            'mapAsset.node:id,title',
        ]);
        $topic->loadCount('messages');

        return [
            'topic' => $this->topicSummary($topic),
            'counts' => [
                'all' => $messageCount,
                'helpful' => $helpfulMessageCount,
                'unconfirmed' => $messageCount - $helpfulMessageCount,
            ],
            'messages' => $messagePage
                ->getCollection()
                ->map(fn (LearnerMessage $message): array => $this->serializeMessage($message))
                ->values()
                ->all(),
            'pagination' => $this->pagination($messagePage),
        ];
    }

    /** @return array<string, mixed> */
    private function topicSummary(LearningMessageTopic $topic): array
    {
        return [
            'id' => $topic->id,
            'title' => $topic->title,
            'messageCount' => (int) ($topic->messages_count ?? 0),
            'mapAsset' => [
                'id' => $topic->mapAsset->id,
                'title' => $topic->mapAsset->node?->title
                    ?: $topic->mapAsset->text
                    ?: "MapAsset {$topic->mapAsset->id}",
                'mapTitle' => $topic->mapAsset->map->title,
            ],
        ];
    }

    /** @return array<string, int> */
    private function pagination(LengthAwarePaginator $page): array
    {
        return [
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'perPage' => $page->perPage(),
            'total' => $page->total(),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeMessage(LearnerMessage $message): array
    {
        return [
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
        ];
    }
}
