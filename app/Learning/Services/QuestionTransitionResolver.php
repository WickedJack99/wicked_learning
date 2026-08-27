<?php

namespace App\Learning\Services;

use App\Models\ActivityTransition;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;

class QuestionTransitionResolver
{
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
