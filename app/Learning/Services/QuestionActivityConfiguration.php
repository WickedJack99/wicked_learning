<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningQuestion;

/** Keeps the separate question records aligned with a question activity. */
class QuestionActivityConfiguration
{
    /**
     * @return array<string, mixed>|null
     */
    public function snapshot(LearningActivity $activity): ?array
    {
        $activity->loadMissing('question.options');
        $question = $activity->question;

        if (! $question instanceof LearningQuestion) {
            return null;
        }

        return [
            'allowMultiple' => $question->allow_multiple,
            'explanation' => $question->explanation,
            'feedbackCorrect' => $question->feedback_correct,
            'feedbackIncorrect' => $question->feedback_incorrect,
            'options' => $question->options
                ->map(fn ($option): array => [
                    'body' => $option->body,
                    'feedback' => $option->feedback,
                    'isCorrect' => $option->is_correct,
                    'label' => $option->label,
                    'outcomeKey' => $option->outcome_key,
                    'sortOrder' => $option->sort_order,
                    'weights' => $option->weights ?? [],
                ])
                ->values()
                ->all(),
            'prompt' => $question->prompt,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $updates
     */
    public function willChange(LearningActivity $activity, array $data, array $updates = []): bool
    {
        $type = (string) ($updates['type'] ?? $activity->type);

        if ($type !== 'question') {
            return $activity->question()->exists();
        }

        if (! $this->hasQuestionData($data)) {
            return false;
        }

        return $this->snapshot($activity) !== $this->requestedSnapshot($activity, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function sync(LearningActivity $activity, array $data): bool
    {
        if ($activity->type !== 'question') {
            if (! $activity->question()->exists()) {
                return false;
            }

            $activity->question()->delete();

            return true;
        }

        if (! $this->hasQuestionData($data)) {
            return false;
        }

        $snapshot = $this->requestedSnapshot($activity, $data);
        $question = $activity->question()->firstOrNew();
        $question->forceFill([
            'allow_multiple' => $snapshot['allowMultiple'],
            'explanation' => $snapshot['explanation'],
            'feedback_correct' => $snapshot['feedbackCorrect'],
            'feedback_incorrect' => $snapshot['feedbackIncorrect'],
            'prompt' => $snapshot['prompt'],
        ])->save();

        $question->options()->delete();

        foreach ($snapshot['options'] as $option) {
            $question->options()->create([
                'body' => $option['body'],
                'feedback' => $option['feedback'],
                'is_correct' => $option['isCorrect'],
                'label' => $option['label'],
                'outcome_key' => $option['outcomeKey'],
                'sort_order' => $option['sortOrder'],
                'weights' => $option['weights'],
            ]);
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function syncSnapshot(LearningActivity $activity, array $snapshot): bool
    {
        if ($activity->type !== 'question') {
            return $this->sync($activity, []);
        }

        if (! isset($snapshot['prompt'])) {
            return false;
        }

        return $this->sync($activity, [
            'question_allow_multiple' => $snapshot['allowMultiple'] ?? false,
            'question_explanation' => $snapshot['explanation'] ?? '',
            'question_feedback_correct' => $snapshot['feedbackCorrect'] ?? '',
            'question_feedback_incorrect' => $snapshot['feedbackIncorrect'] ?? '',
            'question_options' => collect(is_array($snapshot['options'] ?? null) ? $snapshot['options'] : [])
                ->map(fn (mixed $option): array => [
                    'body' => is_array($option) ? ($option['body'] ?? '') : '',
                    'feedback' => is_array($option) ? ($option['feedback'] ?? '') : '',
                    'is_correct' => is_array($option) ? ($option['isCorrect'] ?? false) : false,
                    'label' => is_array($option) ? ($option['label'] ?? '') : '',
                    'outcome_key' => is_array($option) ? ($option['outcomeKey'] ?? '') : '',
                    'weights' => is_array($option) && is_array($option['weights'] ?? null)
                        ? $option['weights']
                        : [],
                ])
                ->all(),
            'question_prompt' => $snapshot['prompt'],
        ]);
    }

    /** @param array<string, mixed> $data */
    private function hasQuestionData(array $data): bool
    {
        return array_key_exists('question_prompt', $data)
            || array_key_exists('question_options', $data)
            || array_key_exists('question_feedback_correct', $data)
            || array_key_exists('question_feedback_incorrect', $data)
            || array_key_exists('question_explanation', $data)
            || array_key_exists('question_allow_multiple', $data);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{allowMultiple: bool, explanation: string, feedbackCorrect: string, feedbackIncorrect: string, options: list<array{body: string, feedback: string, isCorrect: bool, label: string, outcomeKey: string, sortOrder: int, weights: array<string, mixed>}>, prompt: string}
     */
    private function requestedSnapshot(LearningActivity $activity, array $data): array
    {
        $existing = $this->snapshot($activity) ?? [
            'allowMultiple' => false,
            'explanation' => '',
            'feedbackCorrect' => '',
            'feedbackIncorrect' => '',
            'options' => [],
            'prompt' => '',
        ];

        $options = array_key_exists('question_options', $data)
            ? (is_array($data['question_options']) ? $data['question_options'] : [])
            : $existing['options'];

        return [
            'allowMultiple' => array_key_exists('question_allow_multiple', $data)
                ? filter_var($data['question_allow_multiple'], FILTER_VALIDATE_BOOLEAN)
                : (bool) $existing['allowMultiple'],
            'explanation' => array_key_exists('question_explanation', $data)
                ? trim((string) $data['question_explanation'])
                : (string) $existing['explanation'],
            'feedbackCorrect' => array_key_exists('question_feedback_correct', $data)
                ? trim((string) $data['question_feedback_correct'])
                : (string) $existing['feedbackCorrect'],
            'feedbackIncorrect' => array_key_exists('question_feedback_incorrect', $data)
                ? trim((string) $data['question_feedback_incorrect'])
                : (string) $existing['feedbackIncorrect'],
            'options' => collect($options)
                ->filter(fn (mixed $option): bool => is_array($option))
                ->map(fn (array $option, int $index): array => [
                    'body' => trim((string) ($option['body'] ?? '')),
                    'feedback' => trim((string) ($option['feedback'] ?? '')),
                    'isCorrect' => filter_var($option['is_correct'] ?? $option['isCorrect'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'label' => trim((string) ($option['label'] ?? '')),
                    'outcomeKey' => trim((string) ($option['outcome_key'] ?? $option['outcomeKey'] ?? '')),
                    'sortOrder' => ($index + 1) * 10,
                    'weights' => is_array($option['weights'] ?? null) ? $option['weights'] : [],
                ])
                ->values()
                ->all(),
            'prompt' => array_key_exists('question_prompt', $data)
                ? trim((string) $data['question_prompt'])
                : (string) $existing['prompt'],
        ];
    }
}
