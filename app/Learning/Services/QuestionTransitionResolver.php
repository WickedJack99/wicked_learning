<?php

namespace App\Learning\Services;

use App\Models\ActivityTransition;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;

class QuestionTransitionResolver
{
    /**
     * @param  list<LearningQuestionOption>  $selectedOptions
     */
    public function forSelection(
        LearningQuestion $question,
        array $selectedOptions,
        bool $isCorrect,
    ): ?ActivityTransition {
        if (! $question->allow_multiple && count($selectedOptions) === 1) {
            return $this->for($question, $selectedOptions[0]);
        }

        $question->loadMissing('activity.transitions');

        return $question->activity->transitions
            ->first(fn (ActivityTransition $transition): bool => $transition->trigger === ($isCorrect ? 'correct' : 'incorrect'));
    }

    public function for(
        LearningQuestion $question,
        LearningQuestionOption $option,
    ): ?ActivityTransition {
        $question->loadMissing('activity.transitions');
        $trigger = $option->is_correct ? 'correct' : 'incorrect';

        return $question->activity->transitions
            ->first(fn (ActivityTransition $transition): bool => $transition->trigger === 'outcome'
                && $transition->trigger_value === $option->outcome_key
            )
            ?: $question->activity->transitions
                ->first(fn (ActivityTransition $transition): bool => $transition->trigger === $trigger
                );
    }
}
