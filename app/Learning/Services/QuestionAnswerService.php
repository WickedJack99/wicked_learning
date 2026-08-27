<?php

namespace App\Learning\Services;

use App\Models\LearnerQuestionAnswer;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;

class QuestionAnswerService
{
    public function __construct(
        private readonly LearnerProgressService $progressService,
        private readonly QuestionTransitionResolver $transitionResolver,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function answer(
        int $userId,
        LearningQuestion $question,
        int $optionId,
        ?string $playRunId = null,
        ?string $confidence = null,
    ): array {
        $question->loadMissing('activity.node', 'activity.transitions', 'options');
        $option = $this->optionForQuestion($question, $optionId);
        $feedback = $this->feedbackFor($question, $option);

        LearnerQuestionAnswer::query()->create([
            'user_id' => $userId,
            'learning_question_id' => $question->id,
            'learning_question_option_id' => $option->id,
            'is_correct' => $option->is_correct,
            'confidence' => $confidence,
            'selected_option_ids' => [$option->id],
            'feedback' => $feedback,
        ]);

        $this->progressService->mark(
            userId: $userId,
            activity: $question->activity,
            status: 'completed',
            playRunId: $playRunId,
            outcome: $option->is_correct ? 'correct' : 'incorrect',
        );
        $transition = $this->transitionResolver->for($question, $option);

        return [
            'questionId' => $question->id,
            'optionId' => $option->id,
            'isCorrect' => $option->is_correct,
            'confidence' => $confidence,
            'feedback' => $feedback,
            'explanation' => $question->explanation,
            'nextActivityId' => $transition?->to_activity_id,
        ];
    }

    private function optionForQuestion(LearningQuestion $question, int $optionId): LearningQuestionOption
    {
        return LearningQuestionOption::query()
            ->where('learning_question_id', $question->id)
            ->findOrFail($optionId);
    }

    private function feedbackFor(LearningQuestion $question, LearningQuestionOption $option): ?string
    {
        return $option->feedback
            ?: ($option->is_correct ? $question->feedback_correct : $question->feedback_incorrect);
    }
}
