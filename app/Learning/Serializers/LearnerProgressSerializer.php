<?php

namespace App\Learning\Serializers;

use App\Learning\Services\QuestionTransitionResolver;
use App\Models\LearnerActivityProgress;
use App\Models\LearnerQuestionAnswer;
use App\Models\LearnerRecallItem;
use DateTimeInterface;
use Illuminate\Support\Carbon;

class LearnerProgressSerializer
{
    public function __construct(private readonly QuestionTransitionResolver $transitionResolver) {}

    /**
     * @return array<string, mixed>
     */
    public function empty(): array
    {
        return [
            'activities' => [],
            'answers' => [],
            'recallQuestionIds' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forUser(int $userId): array
    {
        return [
            'activities' => $this->activities($userId),
            'answers' => $this->answers($userId),
            'recallQuestionIds' => LearnerRecallItem::query()
                ->where('user_id', $userId)
                ->pluck('learning_question_id')
                ->map(fn (mixed $id): int => (int) $id)
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function activityProgress(LearnerActivityProgress $progress): array
    {
        return [
            'activityId' => $progress->learning_activity_id,
            'status' => $progress->status,
            'completedAt' => $this->dateTimeString($progress->completed_at),
            'metadata' => $progress->metadata ?? [],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function activities(int $userId): array
    {
        return LearnerActivityProgress::query()
            ->where('user_id', $userId)
            ->get()
            ->mapWithKeys(fn (LearnerActivityProgress $progress) => [
                $progress->learning_activity_id => [
                    'status' => $progress->status,
                    'completedAt' => $this->dateTimeString($progress->completed_at),
                    'metadata' => $progress->metadata ?? [],
                ],
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function answers(int $userId): array
    {
        return LearnerQuestionAnswer::query()
            ->where('user_id', $userId)
            ->with(['question.activity.transitions', 'selectedOption'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('learning_question_id')
            ->mapWithKeys(function ($attempts): array {
                /** @var LearnerQuestionAnswer $answer */
                $answer = $attempts->first();

                return [$answer->learning_question_id => [
                    'optionId' => $answer->learning_question_option_id,
                    'isCorrect' => $answer->is_correct,
                    'confidence' => $answer->confidence,
                    'feedback' => $answer->feedback,
                    'explanation' => $answer->question?->explanation,
                    'nextActivityId' => $this->nextActivityId($answer),
                    'earlierAttempts' => $attempts
                        ->slice(1, 3)
                        ->values()
                        ->map(fn (LearnerQuestionAnswer $attempt): array => $this->attempt($attempt))
                        ->all(),
                ]];
            })
            ->all();
    }

    /**
     * @return array{answeredAt: string|null, confidence: string|null, isCorrect: bool, optionLabel: string|null}
     */
    private function attempt(LearnerQuestionAnswer $answer): array
    {
        return [
            'answeredAt' => $answer->created_at instanceof DateTimeInterface
                ? $answer->created_at->format(DateTimeInterface::ATOM)
                : null,
            'confidence' => $answer->confidence,
            'isCorrect' => (bool) $answer->is_correct,
            'optionLabel' => $answer->selectedOption?->label,
        ];
    }

    private function nextActivityId(LearnerQuestionAnswer $answer): ?int
    {
        if (! $answer->question || ! $answer->selectedOption) {
            return null;
        }

        return $this->transitionResolver->for($answer->question, $answer->selectedOption)?->to_activity_id;
    }

    private function dateTimeString(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if (is_string($value) && $value !== '') {
            return Carbon::parse($value)->toIso8601String();
        }

        return null;
    }
}
