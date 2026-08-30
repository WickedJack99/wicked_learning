<?php

namespace App\Learning\Queries;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\LearningMessageTopic;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LoadLearnerMessageModeration
{
    private const RESPONSE_PAGE_SIZE = 3;

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
            ])
            ->withCount('responses')
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

        $responsesByMessage = $this->responsesForMessages(
            $messagePage->getCollection()->modelKeys(),
            1,
            self::RESPONSE_PAGE_SIZE,
        );

        return [
            'topic' => $this->topicSummary($topic),
            'counts' => [
                'all' => $messageCount,
                'helpful' => $helpfulMessageCount,
                'unconfirmed' => $messageCount - $helpfulMessageCount,
            ],
            'messages' => $messagePage
                ->getCollection()
                ->map(fn (LearnerMessage $message): array => $this->serializeMessage(
                    $message,
                    $responsesByMessage[$message->id] ?? collect(),
                    1,
                    self::RESPONSE_PAGE_SIZE,
                ))
                ->values()
                ->all(),
            'pagination' => $this->pagination($messagePage),
        ];
    }

    /** @return array<string, mixed> */
    public function responses(
        LearnerMessage $message,
        int $page = 1,
        int $perPage = self::RESPONSE_PAGE_SIZE,
    ): array {
        $page = max($page, 1);
        $perPage = min(max($perPage, 1), 12);
        $message->loadCount('responses');
        $responses = $this->responsesForMessages([$message->id], $page, $perPage)[$message->id]
            ?? collect();

        return [
            'messageId' => $message->id,
            'responses' => $this->serializeResponses($responses),
            'pagination' => $this->responsePagination(
                (int) $message->responses_count,
                $page,
                $perPage,
            ),
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

    /**
     * @param  Collection<int, LearnerMessageResponse>  $responses
     * @return array<string, mixed>
     */
    private function serializeMessage(
        LearnerMessage $message,
        Collection $responses,
        int $responsePage,
        int $responsePerPage,
    ): array {
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
            'responseCount' => (int) $message->responses_count,
            'responsePagination' => $this->responsePagination(
                (int) $message->responses_count,
                $responsePage,
                $responsePerPage,
            ),
            'responses' => $this->serializeResponses($responses),
        ];
    }

    /**
     * @param  Collection<int, LearnerMessageResponse>  $responses
     * @return array<int, array<string, mixed>>
     */
    private function serializeResponses(Collection $responses): array
    {
        return $responses->map(fn (LearnerMessageResponse $response): array => [
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
        ])->values()->all();
    }

    /**
     * @param  array<int, int|string>  $messageIds
     * @return array<int, Collection<int, LearnerMessageResponse>>
     */
    private function responsesForMessages(array $messageIds, int $page, int $perPage): array
    {
        if ($messageIds === []) {
            return [];
        }

        $offset = (max($page, 1) - 1) * $perPage;
        $rankedResponses = DB::table('learner_message_responses')
            ->select(['id', 'learner_message_id'])
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY learner_message_id ORDER BY created_at DESC, id DESC) AS response_rank')
            ->whereIn('learner_message_id', $messageIds);
        $responseRows = DB::query()
            ->fromSub($rankedResponses, 'ranked_responses')
            ->whereBetween('response_rank', [$offset + 1, $offset + $perPage])
            ->orderBy('learner_message_id')
            ->orderBy('response_rank')
            ->get();

        if ($responseRows->isEmpty()) {
            return [];
        }

        $responses = LearnerMessageResponse::query()
            ->with([
                'author:id,name,email',
                'hiddenBy:id,name,email',
            ])
            ->whereIn('id', $responseRows->pluck('id'))
            ->get()
            ->keyBy('id');

        return $responseRows
            ->groupBy('learner_message_id')
            ->map(fn (Collection $rows): Collection => $rows
                ->map(fn (object $row): ?LearnerMessageResponse => $responses->get($row->id))
                ->filter()
                ->values())
            ->all();
    }

    /** @return array<string, int> */
    private function responsePagination(int $total, int $currentPage, int $perPage): array
    {
        return [
            'currentPage' => min(max($currentPage, 1), max(1, (int) ceil($total / $perPage))),
            'lastPage' => max(1, (int) ceil($total / $perPage)),
            'perPage' => $perPage,
            'total' => $total,
        ];
    }
}
