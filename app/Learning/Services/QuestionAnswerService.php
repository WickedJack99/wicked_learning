<?php

namespace App\Learning\Services;

use App\Models\LearnerQuestionAnswer;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use DateTimeInterface;
use Illuminate\Support\Collection;

class QuestionAnswerService
{
    public function __construct(
        private readonly LearnerProgressService $progressService,
        private readonly LearnerRecallItemService $recallItems,
        private readonly QuestionTransitionResolver $transitionResolver,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function answer(
        int $userId,
        LearningQuestion $question,
        array $optionIds,
        ?string $playRunId = null,
        ?string $confidence = null,
        bool $isRevisit = false,
        bool $isRecall = false,
        bool $deferCompletion = false,
    ): array {
        $question->loadMissing('activity.node', 'activity.transitions', 'options');
        $selectedOptions = $this->optionsForQuestion($question, $optionIds);
        $selectedOptionIds = $selectedOptions->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();
        $isCorrect = $question->allow_multiple
            ? $this->selectionIsCorrect($question, $selectedOptionIds)
            : (bool) $selectedOptions->first()->is_correct;
        $feedback = $this->feedbackFor($question, $selectedOptions->all(), $isCorrect);
        $calibration = $this->calibrationFor($isCorrect, $confidence);
        $attemptNumber = LearnerQuestionAnswer::query()
            ->where('user_id', $userId)
            ->where('learning_question_id', $question->id)
            ->count() + 1;

        $answer = LearnerQuestionAnswer::query()->create([
            'user_id' => $userId,
            'learning_question_id' => $question->id,
            'learning_question_option_id' => $selectedOptionIds[0],
            'is_correct' => $isCorrect,
            'confidence' => $confidence,
            'calibration' => $calibration,
            'selected_option_ids' => $selectedOptionIds,
            'feedback' => $feedback,
        ]);

        if (! $deferCompletion) {
            $this->progressService->mark(
                userId: $userId,
                activity: $question->activity,
                status: 'completed',
                playRunId: $playRunId,
                outcome: $isCorrect ? 'correct' : 'incorrect',
                confidence: $confidence,
                attemptNumber: $attemptNumber,
                assistanceLevel: 'independent',
                isRevisit: $isRevisit,
                calibration: $calibration,
            );
        }
        $recall = $isRecall
            ? $this->recallItems->recordRecall(
                $userId,
                $question,
                $isCorrect,
                $confidence,
            )
            : null;
        $transition = $this->transitionResolver->forSelection(
            $question,
            $selectedOptions->all(),
            $isCorrect,
        );

        return [
            'questionId' => $question->id,
            'optionId' => $selectedOptionIds[0],
            'optionIds' => $selectedOptionIds,
            'isCorrect' => $isCorrect,
            'confidence' => $confidence,
            'calibration' => $calibration,
            'attemptNumber' => $attemptNumber,
            'feedback' => $feedback,
            'explanation' => $question->explanation,
            'nextActivityId' => $transition?->to_activity_id,
            'earlierAttempts' => $this->earlierAttempts($userId, $question->id, $answer->id),
            'recall' => $recall,
        ];
    }

    /**
     * @return list<array{answeredAt: string|null, calibration: string|null, confidence: string|null, isCorrect: bool, optionLabel: string|null, optionLabels: list<string>}>
     */
    private function earlierAttempts(int $userId, int $questionId, int $answerId): array
    {
        return LearnerQuestionAnswer::query()
            ->where('user_id', $userId)
            ->where('learning_question_id', $questionId)
            ->whereKeyNot($answerId)
            ->with(['question.options', 'selectedOption'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get()
            ->map(fn (LearnerQuestionAnswer $answer): array => $this->attempt($answer))
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

    /**
     * @param  list<int>  $optionIds
     * @return Collection<int, LearningQuestionOption>
     */
    private function optionsForQuestion(LearningQuestion $question, array $optionIds): Collection
    {
        $options = $question->options
            ->filter(fn (LearningQuestionOption $option): bool => in_array($option->id, $optionIds, true))
            ->values();

        abort_unless($options->count() === count($optionIds), 422, 'Choose options from this question.');

        return $options;
    }

    /**
     * @param  list<int>  $selectedOptionIds
     */
    private function selectionIsCorrect(LearningQuestion $question, array $selectedOptionIds): bool
    {
        $correctOptionIds = $question->options
            ->filter(fn (LearningQuestionOption $option): bool => $option->is_correct)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        sort($correctOptionIds);
        sort($selectedOptionIds);

        return $correctOptionIds === $selectedOptionIds;
    }

    /**
     * @param  list<LearningQuestionOption>  $selectedOptions
     */
    private function feedbackFor(
        LearningQuestion $question,
        array $selectedOptions,
        bool $isCorrect,
    ): ?string {
        if (! $question->allow_multiple && count($selectedOptions) === 1) {
            return $selectedOptions[0]->feedback
                ?: ($isCorrect ? $question->feedback_correct : $question->feedback_incorrect);
        }

        return $isCorrect ? $question->feedback_correct : $question->feedback_incorrect;
    }

    /**
     * @return list<string>
     */
    private function selectedOptionLabels(LearnerQuestionAnswer $answer): array
    {
        $selectedOptionIds = is_array($answer->selected_option_ids)
            ? array_map(static fn (mixed $optionId): int => (int) $optionId, $answer->selected_option_ids)
            : [];
        if (! is_array($selectedOptionIds) || $selectedOptionIds === []) {
            return $answer->selectedOption?->label ? [$answer->selectedOption->label] : [];
        }

        return $answer->question?->options
            ->filter(fn (LearningQuestionOption $option): bool => in_array($option->id, $selectedOptionIds, true))
            ->map(fn (LearningQuestionOption $option): string => $option->label)
            ->values()
            ->all() ?? [];
    }

    private function calibrationFor(bool $isCorrect, ?string $confidence): ?string
    {
        if ($confidence === null) {
            return null;
        }

        return match (true) {
            $isCorrect && $confidence === 'settled' => 'aligned',
            $isCorrect => 'stronger_than_expected',
            $confidence === 'settled' => 'higher_than_result',
            default => 'uncertainty_made_gap_visible',
        };
    }
}
