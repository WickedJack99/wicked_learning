<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('npc_dialogue_nodes')
            ->where('type', 'npc_interaction')
            ->orderBy('id')
            ->get()
            ->each(function (object $question): void {
                $questionRow = (array) $question;
                $config = $this->decodeConfig($questionRow['config'] ?? null);
                $answers = $this->answerConfig($config);

                if ($answers === []) {
                    return;
                }

                $config['questionOutputCount'] = count($answers);
                unset($config['answers']);

                DB::table('npc_dialogue_nodes')
                    ->where('id', $this->intValue($questionRow, 'id'))
                    ->update(['config' => json_encode($config)]);

                foreach ($answers as $index => $answer) {
                    $this->createAnswerNode($questionRow, $answer, $index);
                }
            });
    }

    public function down(): void
    {
        // The new graph model stores answers as first-class nodes. Recreating
        // the older embedded answer arrays would drop graph layout and routing.
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeConfig(mixed $config): array
    {
        if (is_array($config)) {
            return $config;
        }

        if (! is_string($config)) {
            return [];
        }

        $decoded = json_decode($config, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<int, array<string, mixed>>
     */
    private function answerConfig(array $config): array
    {
        if (($config['interactionMode'] ?? null) !== 'question' || ! is_array($config['answers'] ?? null)) {
            return [];
        }

        return array_values(array_filter(
            $config['answers'],
            fn (mixed $answer): bool => is_array($answer),
        ));
    }

    /**
     * @param  array<string, mixed>  $question
     * @param  array<string, mixed>  $answer
     */
    private function createAnswerNode(array $question, array $answer, int $index): void
    {
        $now = now();
        $answerKey = (string) ($answer['key'] ?? 'answer-'.($index + 1));
        $answerLabel = (string) ($answer['label'] ?? chr(65 + ($index % 26)));
        $outgoingTargetId = $this->oldOutgoingTargetId($question, $answerKey);
        $answerNodeId = DB::table('npc_dialogue_nodes')->insertGetId([
            'learning_activity_id' => $this->intValue($question, 'learning_activity_id'),
            'type' => 'answer',
            'title' => trim($answerLabel.' Answer'),
            'body' => (string) ($answer['body'] ?? ''),
            'config' => json_encode([
                'answerLabel' => $answerLabel,
                'isCorrect' => (bool) ($answer['isCorrect'] ?? false),
            ]),
            'sort_order' => $this->intValue($question, 'sort_order') + $index + 1,
            'graph_position_x' => $this->nullableIntValue($question, 'graph_position_x') === null
                ? null
                : $this->nullableIntValue($question, 'graph_position_x') + 300,
            'graph_position_y' => $this->nullableIntValue($question, 'graph_position_y') === null
                ? null
                : $this->nullableIntValue($question, 'graph_position_y') + ($index * 130),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('npc_dialogue_transitions')->updateOrInsert([
            'learning_activity_id' => $this->intValue($question, 'learning_activity_id'),
            'from_dialogue_node_id' => $this->intValue($question, 'id'),
            'from_connector' => 'answer-'.($index + 1),
            'to_dialogue_node_id' => $answerNodeId,
        ], [
            'to_connector' => 'in',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($outgoingTargetId !== null) {
            DB::table('npc_dialogue_transitions')
                ->where('id', $outgoingTargetId)
                ->update([
                    'from_dialogue_node_id' => $answerNodeId,
                    'from_connector' => 'out',
                    'updated_at' => $now,
                ]);
        }
    }

    /**
     * @param  array<string, mixed>  $question
     */
    private function oldOutgoingTargetId(array $question, string $answerKey): ?int
    {
        $id = DB::table('npc_dialogue_transitions')
            ->where('learning_activity_id', $this->intValue($question, 'learning_activity_id'))
            ->where('from_dialogue_node_id', $this->intValue($question, 'id'))
            ->where('from_connector', $answerKey)
            ->value('id');

        return is_numeric($id) ? (int) $id : null;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function intValue(array $row, string $key): int
    {
        return (int) ($row[$key] ?? 0);
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function nullableIntValue(array $row, string $key): ?int
    {
        return is_numeric($row[$key] ?? null) ? (int) $row[$key] : null;
    }
};
