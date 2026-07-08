<?php

namespace App\Learning\Services;

use App\Models\NpcDialogueAnswer;
use App\Models\NpcDialogueNode;
use Illuminate\Validation\ValidationException;

class NpcDialogueAnswerService
{
    /**
     * @return array<string, mixed>
     */
    public function answer(int $userId, NpcDialogueNode $node, string $answerKey): array
    {
        $node->loadMissing('activity');
        $answer = $this->answerOption($node, $answerKey);

        NpcDialogueAnswer::query()->create([
            'answer_key' => $answerKey,
            'answer_label' => $answer['label'] ?? null,
            'feedback' => $answer['feedback'] ?? null,
            'is_correct' => (bool) ($answer['isCorrect'] ?? false),
            'learning_activity_id' => $node->activity->id,
            'npc_dialogue_node_id' => $node->id,
            'user_id' => $userId,
        ]);

        return [
            'answerKey' => $answerKey,
            'feedback' => $answer['feedback'] ?? null,
            'isCorrect' => (bool) ($answer['isCorrect'] ?? false),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function answerOption(NpcDialogueNode $node, string $answerKey): array
    {
        $config = is_array($node->config) ? $node->config : [];
        $answers = is_array($config['answers'] ?? null) ? $config['answers'] : [];

        foreach ($answers as $answer) {
            if (is_array($answer) && ($answer['key'] ?? null) === $answerKey) {
                return $answer;
            }
        }

        throw ValidationException::withMessages([
            'answer_key' => 'The selected answer does not exist for this dialogue node.',
        ]);
    }
}
