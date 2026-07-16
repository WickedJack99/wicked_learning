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
            'type' => ['required', 'string', Rule::in(['answer', 'npc_monologue', 'npc_question', 'reflection', 'end'])],
            'title' => ['required', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:4000'],
            'config' => ['nullable', 'array'],
            'config.*' => ['nullable'],
            ...$this->sceneAssetRules(),
            ...$this->answerEventRules(),
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
            'type' => ['sometimes', 'required', 'string', Rule::in(['answer', 'npc_monologue', 'npc_question', 'reflection', 'end'])],
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'body' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'config' => ['sometimes', 'nullable', 'array'],
            'config.*' => ['nullable'],
            ...$this->sceneAssetRules(),
            ...$this->answerEventRules(),
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

    /**
     * @return array<string, mixed>
     */
    private function sceneAssetRules(): array
    {
        return [
            'config.sceneAssets' => ['nullable', 'array'],
            'config.sceneAssets.*.id' => ['nullable', 'string', 'max:120'],
            'config.sceneAssets.*.imageDark' => ['nullable', 'string', 'max:2048'],
            'config.sceneAssets.*.imageLight' => ['nullable', 'string', 'max:2048'],
            'config.sceneAssets.*.label' => ['nullable', 'string', 'max:120'],
            'config.sceneAssets.*.layer' => ['nullable', 'string', Rule::in(['behind_npc', 'front', 'bubble', 'overlay'])],
            'config.sceneAssets.*.mirrored' => ['nullable', 'boolean'],
            'config.sceneAssets.*.width' => ['nullable', 'numeric', 'min:1', 'max:100'],
            'config.sceneAssets.*.x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'config.sceneAssets.*.y' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function answerEventRules(): array
    {
        return [
            'config.events' => ['nullable', 'array'],
            'config.events.hideNodeIds' => ['nullable', 'array'],
            'config.events.hideNodeIds.*' => ['integer', 'exists:learning_nodes,id'],
            'config.events.unlockNodeIds' => ['nullable', 'array'],
            'config.events.unlockNodeIds.*' => ['integer', 'exists:learning_nodes,id'],
        ];
    }
}
