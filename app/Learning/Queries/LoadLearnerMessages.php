<?php

namespace App\Learning\Queries;

use App\Models\LearnerMessage;
use App\Models\LearnerMessageResponse;
use App\Models\LearningMessageTopic;
use App\Models\User;
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
        $messages = $topic->messages()->where('audience', $audience);
        $messagePage = (clone $messages)
            ->whereNull('hidden_at')
            ->latest()
            ->orderByDesc('id')
            ->paginate(min(max($perPage, 1), 12), ['*'], 'page', max($page, 1));
        $loadedMessages = $messagePage->getCollection()->shuffle()->values();
        $messageIds = $loadedMessages->modelKeys();
        $respondedMessageIds = $allowResponses && $messageIds !== []
            ? LearnerMessageResponse::query()
                ->whereIn('learner_message_id', $messageIds)
                ->where('user_id', $user->id)
                ->pluck('learner_message_id')
                ->map(fn (int|string $id): int => (int) $id)
            : collect();
        $responsesByMessage = $allowResponses && $messageIds !== []
            ? $this->visibleResponses($messageIds)
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
                ->map(function (LearnerMessage $message) use ($allowResponses, $respondedMessageIds, $responsesByMessage, $user): array {
                    $responses = $allowResponses
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
     * @return array<int|string, array<int, array{id: int, body: string, responseType: ?string}>>
     */
    private function visibleResponses(array $messageIds): array
    {
        $rankedResponses = DB::table('learner_message_responses')
            ->select(['id', 'learner_message_id', 'body', 'response_type', 'created_at'])
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY learner_message_id ORDER BY created_at DESC, id DESC) AS response_rank')
            ->whereIn('learner_message_id', $messageIds)
            ->whereNull('hidden_at');

        return DB::query()
            ->fromSub($rankedResponses, 'ranked_responses')
            ->where('response_rank', '<=', 3)
            ->orderBy('learner_message_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('learner_message_id')
            ->map(fn (Collection $responses): array => $responses
                ->map(fn (object $response): array => [
                    'id' => (int) $response->id,
                    'body' => (string) $response->body,
                    'responseType' => $response->response_type !== null
                        ? (string) $response->response_type
                        : null,
                ])
                ->values()
                ->all())
            ->all();
    }
}
