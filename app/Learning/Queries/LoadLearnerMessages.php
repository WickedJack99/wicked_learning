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
    ): array {
        $messages = $topic->messages()->where('audience', $audience);
        $loadedMessages = (clone $messages)
            ->whereNull('hidden_at')
            ->latest()
            ->limit(12)
            ->get();
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
            'messages' => $loadedMessages
                ->shuffle()
                ->values()
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
     * @return array<int|string, array<int, array{id: int, body: string}>>
     */
    private function visibleResponses(array $messageIds): array
    {
        return DB::table('learner_message_responses')
            ->select(['id', 'learner_message_id', 'body', 'created_at'])
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY learner_message_id ORDER BY created_at DESC, id DESC) AS response_rank')
            ->whereIn('learner_message_id', $messageIds)
            ->whereNull('hidden_at')
            ->orderBy('learner_message_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (object $response): bool => (int) $response->response_rank <= 3)
            ->groupBy('learner_message_id')
            ->map(fn (Collection $responses): array => $responses
                ->map(fn (object $response): array => [
                    'id' => (int) $response->id,
                    'body' => (string) $response->body,
                ])
                ->values()
                ->all())
            ->all();
    }
}
