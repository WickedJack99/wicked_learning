<?php

namespace App\Learning\Validation;

use Illuminate\Validation\Rule;

class AdminNpcDialogueRules
{
    /**
     * @return array<string, mixed>
     */
    public function storeNode(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(['answer', 'npc_monologue', 'npc_question', 'end'])],
            'title' => ['required', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:4000'],
            'config' => ['nullable', 'array'],
            'config.*' => ['nullable'],
            'config.toolId' => ['nullable', 'integer', 'exists:learning_tools,id'],
            'graph_position_x' => ['nullable', 'integer'],
            'graph_position_y' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function updateNode(): array
    {
        return [
            'type' => ['sometimes', 'required', 'string', Rule::in(['answer', 'npc_monologue', 'npc_question', 'end'])],
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'body' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'config' => ['sometimes', 'nullable', 'array'],
            'config.*' => ['nullable'],
            'config.toolId' => ['nullable', 'integer', 'exists:learning_tools,id'],
            'graph_position_x' => ['sometimes', 'required', 'integer'],
            'graph_position_y' => ['sometimes', 'required', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function transition(): array
    {
        return [
            'from_dialogue_node_id' => ['nullable', 'integer'],
            'to_dialogue_node_id' => ['required', 'integer'],
            'from_connector' => ['required', 'string', 'max:80'],
            'to_connector' => ['required', 'string', 'max:80'],
        ];
    }
}
