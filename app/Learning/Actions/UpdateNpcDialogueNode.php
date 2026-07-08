<?php

namespace App\Learning\Actions;

use App\Learning\Services\NpcDialogueConfiguration;
use App\Models\NpcDialogueNode;

class UpdateNpcDialogueNode
{
    public function __construct(private readonly NpcDialogueConfiguration $configuration) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(NpcDialogueNode $node, array $data): NpcDialogueNode
    {
        $updates = [];

        foreach (['title', 'body', 'graph_position_x', 'graph_position_y'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        if (array_key_exists('config', $data)) {
            $updates['config'] = $this->configuration->configFor(
                $node->type,
                $data,
                is_array($node->config) ? $node->config : [],
            );
        }

        $node->forceFill($updates)->save();

        return $node;
    }
}
