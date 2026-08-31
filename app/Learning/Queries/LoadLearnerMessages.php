<?php

namespace App\Learning\Queries;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\LearningMessageTopic;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LoadLearnerMessages
{
    /** @return array<string, mixed> */
    public function handle(
        LearningMessageTopic $topic,
        User $user,
        string $audience = 'peers',
        bool $allowResponses = false,
        int $page = 1,
        int $perPage = 12,
    ): array {
        $messages = $topic->messages()
            ->where('audience', $audience)
            ->when(
                $audience === 'support',
                fn ($query) => $query->where('user_id', $user->id),
            );
        $includeResponses = $allowResponses || $audience === 'support';
        $messagePage = (clone $messages)
            ->whereNull('hidden_at')
            ->latest()
            ->orderByDesc('id')
            ->paginate(min(max($perPage, 1), 12), ['*'], 'page', max($page, 1));
        $loadedMessages = $messagePage->getCollection()->shuffle()->values();
        $messageIds = $loadedMessages->modelKeys();
        $messageAuthors = $loadedMessages->mapWithKeys(
            fn (LearnerMessage $message): array => [$message->id => $message->user_id],
        );
        $respondedMessageIds = $allowResponses && $messageIds !== []
            ? LearnerMessageResponse::query()
                ->whereIn('learner_message_id', $messageIds)
                ->where('user_id', $user->id)
                ->pluck('learner_message_id')
                ->map(fn (int|string $id): int => (int) $id)
            : collect();
        $responsesByMessage = $includeResponses && $messageIds !== []
            ? $this->visibleResponses($messageIds, $messageAuthors, $user->id)
            : [];

        return [
            'topic' => [
                'id' => $topic->id,
                'title' => $topic->title,
            ],
            'hasContributed' => (clone $messages)
                ->where('user_id', $user->id)
                ->exists(),
            'pagination' => [
                'currentPage' => $messagePage->currentPage(),
                'lastPage' => $messagePage->lastPage(),
                'perPage' => $messagePage->perPage(),
                'total' => $messagePage->total(),
            ],
            'messages' => $loadedMessages
                ->map(function (LearnerMessage $message) use ($allowResponses, $includeResponses, $respondedMessageIds, $responsesByMessage, $user): array {
                    $responses = $includeResponses
                        ? collect($responsesByMessage[$message->id] ?? [])
                            ->reverse()
                            ->values()
                            ->all()
                        : [];

                    return [
                        'body' => $message->body,
                        'canRespond' => $allowResponses && $message->user_id !== $user->id,
                        'hasResponded' => $allowResponses
                            && $respondedMessageIds->contains($message->id),
                        'id' => $message->id,
                        'responses' => $responses,
                    ];
                })
                ->all(),
        ];
    }

    /**
     * @param  array<int, int|string>  $messageIds
     * @param  Collection<int|string, int|string>  $messageAuthors
     * @return array<int|string, array<int, array{id: int, body: string, canMarkHelpful: bool, isHelpful: bool, responseType: ?string}>>
     */
    private function visibleResponses(array $messageIds, Collection $messageAuthors, int $userId): array
    {
        $rankedResponses = DB::table('learner_message_responses')
            ->select(['id', 'learner_message_id', 'body', 'response_type', 'created_at', 'helpful_at'])
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY learner_message_id ORDER BY created_at DESC, id DESC) AS response_rank')
            ->whereIn('learner_message_id', $messageIds)
            ->whereNull('hidden_at');

        return DB::query()
            ->fromSub($rankedResponses, 'ranked_responses')
            ->where(function (Builder $query): void {
                $query
                    ->where('response_rank', '<=', 3)
                    ->orWhereNotNull('helpful_at');
            })
            ->orderBy('learner_message_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('learner_message_id')
            ->map(fn (Collection $responses): array => $responses
                ->map(fn (object $response): array => [
                    'id' => (int) $response->id,
                    'body' => (string) $response->body,
                    'canMarkHelpful' => ($messageAuthors[$response->learner_message_id] ?? null) === $userId,
                    'isHelpful' => $response->helpful_at !== null,
                    'responseType' => $response->response_type !== null
                        ? (string) $response->response_type
                        : null,
                ])
                ->values()
                ->all())
            ->all();
    }
}
