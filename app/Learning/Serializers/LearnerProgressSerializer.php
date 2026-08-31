<?php

namespace App\Learning\Serializers;

use App\Learning\Services\QuestionTransitionResolver;
use App\Models\ActivityTransition;
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
            ->with(['question.activity.transitions', 'question.options', 'selectedOption'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('learning_question_id')
            ->mapWithKeys(function ($attempts): array {
                /** @var LearnerQuestionAnswer $answer */
                $answer = $attempts->first();
                $nextTransition = $this->nextTransition($answer);

                return [$answer->learning_question_id => [
                    'optionId' => $answer->learning_question_option_id,
                    'optionIds' => $this->selectedOptionIds($answer),
                    'isCorrect' => $answer->is_correct,
                    'confidence' => $answer->confidence,
                    'calibration' => $answer->calibration,
                    'feedback' => $answer->feedback,
                    'explanation' => $answer->question?->explanation,
                    'nextActivityId' => $nextTransition?->to_activity_id,
                    'nextTransitionLabel' => $nextTransition?->label,
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
     * @return array{answeredAt: string|null, calibration: string|null, confidence: string|null, isCorrect: bool, optionLabel: string|null, optionLabels: list<string>}
     */
    private function attempt(LearnerQuestionAnswer $answer): array
    {
        $labels = $this->selectedOptionLabels($answer);

        return [
            'answeredAt' => $answer->created_at instanceof DateTimeInterface
                ? $answer->created_at->format(DateTimeInterface::ATOM)
                : null,
            'calibration' => $answer->calibration,
            'confidence' => $answer->confidence,
            'isCorrect' => (bool) $answer->is_correct,
            'optionLabel' => $labels[0] ?? null,
            'optionLabels' => $labels,
        ];
    }

    private function nextTransition(LearnerQuestionAnswer $answer): ?ActivityTransition
    {
        if (! $answer->question) {
            return null;
        }

        $selectedOptionIds = $this->selectedOptionIds($answer);
        $selectedOptions = $answer->question->options
            ->filter(fn ($option): bool => in_array($option->id, $selectedOptionIds, true))
            ->values()
            ->all();

        return $this->transitionResolver->forSelection(
            $answer->question,
            $selectedOptions,
            (bool) $answer->is_correct,
        );
    }

    /**
     * @return list<int>
     */
    private function selectedOptionIds(LearnerQuestionAnswer $answer): array
    {
        if (is_array($answer->selected_option_ids) && $answer->selected_option_ids !== []) {
            return array_values(array_map(
                static fn (mixed $optionId): int => (int) $optionId,
                $answer->selected_option_ids,
            ));
        }

        return $answer->learning_question_option_id === null
            ? []
            : [$answer->learning_question_option_id];
    }

    /**
     * @return list<string>
     */
    private function selectedOptionLabels(LearnerQuestionAnswer $answer): array
    {
        $selectedOptionIds = $this->selectedOptionIds($answer);

        return $answer->question?->options
            ->filter(fn ($option): bool => in_array($option->id, $selectedOptionIds, true))
            ->map(fn ($option): string => $option->label)
            ->values()
            ->all() ?? [];
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
