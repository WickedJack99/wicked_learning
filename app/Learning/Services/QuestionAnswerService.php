<?php

namespace App\Learning\Services;

use App\Models\ActivityTransition;
use App\Models\LearnerQuestionAnswer;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;

class QuestionAnswerService
{
    public function __construct(private readonly LearnerProgressService $progressService) {}

    /**
     * @return array<string, mixed>
     */
    public function answer(int $userId, LearningQuestion $question, int $optionId): array
    {
        $question->loadMissing('activity.node', 'activity.transitions', 'options');
        $option = $this->optionForQuestion($question, $optionId);
        $feedback = $this->feedbackFor($question, $option);

        LearnerQuestionAnswer::query()->create([
            'user_id' => $userId,
            'learning_question_id' => $question->id,
            'learning_question_option_id' => $option->id,
            'is_correct' => $option->is_correct,
            'selected_option_ids' => [$option->id],
            'feedback' => $feedback,
        ]);

        $this->progressService->mark($userId, $question->activity, 'completed');
        $transition = $this->findQuestionTransition($question, $option);

        return [
            'questionId' => $question->id,
            'optionId' => $option->id,
            'isCorrect' => $option->is_correct,
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

    private function findQuestionTransition(
        LearningQuestion $question,
        LearningQuestionOption $option,
    ): ?ActivityTransition {
        $trigger = $option->is_correct ? 'correct' : 'incorrect';

        return $question->activity->transitions
            ->first(fn ($transition) => $transition->trigger === 'outcome' && $transition->trigger_value === $option->outcome_key)
            ?: $question->activity->transitions->first(fn ($transition) => $transition->trigger === $trigger);
    }
}
