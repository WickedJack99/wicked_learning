<?php

namespace App\Learning\Services;

use App\Models\NpcDialogueAnswer;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;
use Illuminate\Validation\ValidationException;

class NpcDialogueAnswerService
{
    /**
     * @return array<string, mixed>
     */
    public function answer(int $userId, NpcDialogueNode $node, string $answerKey): array
    {
        $node->loadMissing('activity');
        $answer = $this->answerNode($node, $answerKey);
        $config = is_array($answer->config) ? $answer->config : [];
        $label = (string) ($config['answerLabel'] ?? $answer->title);
        $isCorrect = (bool) ($config['isCorrect'] ?? false);

        NpcDialogueAnswer::query()->create([
            'answer_key' => (string) $answer->id,
            'answer_label' => $label,
            'feedback' => null,
            'is_correct' => $isCorrect,
            'learning_activity_id' => $node->activity->id,
            'npc_dialogue_node_id' => $node->id,
            'user_id' => $userId,
        ]);

        return [
            'answerKey' => (string) $answer->id,
            'answerNodeId' => $answer->id,
            'feedback' => null,
            'isCorrect' => $isCorrect,
        ];
    }

    private function answerNode(NpcDialogueNode $question, string $answerKey): NpcDialogueNode
    {
        $answer = NpcDialogueNode::query()
            ->where('learning_activity_id', $question->learning_activity_id)
            ->where('type', 'answer')
            ->whereKey((int) $answerKey)
            ->first();

        if ($answer && $this->isConnectedAnswer($question, $answer)) {
            return $answer;
        }

        throw ValidationException::withMessages([
            'answer_key' => 'The selected answer does not exist for this dialogue node.',
        ]);
    }

    private function isConnectedAnswer(NpcDialogueNode $question, NpcDialogueNode $answer): bool
    {
        return NpcDialogueTransition::query()
            ->where('learning_activity_id', $question->learning_activity_id)
            ->where('from_dialogue_node_id', $question->id)
            ->where('to_dialogue_node_id', $answer->id)
            ->exists();
    }
}
