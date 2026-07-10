<?php

namespace App\Learning\Serializers;

use App\Models\LearnerActivityProgress;
use App\Models\LearnerQuestionAnswer;
use DateTimeInterface;
use Illuminate\Support\Carbon;

class LearnerProgressSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function forUser(int $userId): array
    {
        return [
            'activities' => $this->activities($userId),
            'answers' => $this->answers($userId),
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
            ->latest()
            ->get()
            ->unique('learning_question_id')
            ->mapWithKeys(fn (LearnerQuestionAnswer $answer) => [
                $answer->learning_question_id => [
                    'optionId' => $answer->learning_question_option_id,
                    'isCorrect' => $answer->is_correct,
                    'feedback' => $answer->feedback,
                ],
            ])
            ->all();
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
