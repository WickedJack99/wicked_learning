<?php

namespace App\Learning\Serializers;

use App\Learning\Services\NpcDialogueConfiguration;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;

class AdminNpcDialogueGraphSerializer
{
    public function __construct(private readonly NpcDialogueConfiguration $configuration) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningActivity $activity): array
    {
        $endIndex = 0;

        return [
            'world' => [
                'id' => $activity->node->map->world->id,
                'slug' => $activity->node->map->world->slug,
                'title' => $activity->node->map->world->title,
            ],
            'map' => [
                'id' => $activity->node->map->id,
                'slug' => $activity->node->map->slug,
                'title' => $activity->node->map->title,
            ],
            'node' => [
                'id' => $activity->node->id,
                'slug' => $activity->node->slug,
                'title' => $activity->node->title,
            ],
            'activity' => [
                'id' => $activity->id,
                'slug' => $activity->slug,
                'title' => $activity->title,
                'introduction' => $activity->introduction,
            ],
            'dialogueNodes' => $activity->npcDialogueNodes
                ->map(function (NpcDialogueNode $node) use (&$endIndex): array {
                    $connector = $node->type === 'end'
                        ? $this->configuration->connectorFor($node, $endIndex++)
                        : null;

                    return $this->node($node, $connector);
                })
                ->values()
                ->all(),
            'transitions' => $activity->npcDialogueTransitions
                ->map(fn (NpcDialogueTransition $transition): array => $this->transition($transition))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, string>|null  $connector
     * @return array<string, mixed>
     */
    private function node(NpcDialogueNode $node, ?array $connector): array
    {
        return [
            'id' => $node->id,
            'type' => $node->type,
            'title' => $node->title,
            'body' => $node->body,
            'config' => $node->config ?? [],
            'connector' => $connector,
            'position' => [
                'x' => $node->graph_position_x,
                'y' => $node->graph_position_y,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transition(NpcDialogueTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'fromNodeId' => $transition->from_dialogue_node_id,
            'toNodeId' => $transition->to_dialogue_node_id,
            'fromConnector' => $transition->from_connector,
            'toConnector' => $transition->to_connector,
        ];
    }
}
