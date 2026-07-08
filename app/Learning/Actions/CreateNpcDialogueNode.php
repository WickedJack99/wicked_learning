<?php

namespace App\Learning\Actions;

use App\Learning\Services\NpcDialogueConfiguration;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;

class CreateNpcDialogueNode
{
    public function __construct(private readonly NpcDialogueConfiguration $configuration) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningActivity $activity, array $data): NpcDialogueNode
    {
        $type = (string) $data['type'];

        return $activity->npcDialogueNodes()->create([
            'type' => $type,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'config' => $this->configuration->configFor(
                $type,
                $data,
                [],
                $this->nextEndIndex($activity),
            ),
            'sort_order' => $this->nextSortOrder($activity),
            'graph_position_x' => $data['graph_position_x'] ?? null,
            'graph_position_y' => $data['graph_position_y'] ?? null,
        ]);
    }

    private function nextSortOrder(LearningActivity $activity): int
    {
        return ((int) $activity->npcDialogueNodes()->max('sort_order')) + 10;
    }

    private function nextEndIndex(LearningActivity $activity): int
    {
        return (int) $activity->npcDialogueNodes()->where('type', 'end')->count();
    }
}
