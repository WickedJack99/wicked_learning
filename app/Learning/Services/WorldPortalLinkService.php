<?php

namespace App\Learning\Services;

use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningWorld;
use Illuminate\Validation\ValidationException;

class WorldPortalLinkService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(LearningWorld $world, array $data): void
    {
        $sourceNode = $this->worldNodeOrFail($world, (int) $data['source_learning_node_id']);
        $targetNode = $this->worldNodeOrFail($world, (int) $data['target_learning_node_id']);
        $this->ensureLinkDoesNotExist($sourceNode, $targetNode);

        LearningPortalLink::query()->create([
            'source_learning_node_id' => $sourceNode->id,
            'target_learning_node_id' => $targetNode->id,
            'label' => ($data['label'] ?? null) ?: "{$sourceNode->title} to {$targetNode->title}",
            'description' => $data['description'] ?? null,
            'config' => ['travelMode' => 'portal'],
        ]);
    }

    public function deleteFromWorld(LearningWorld $world, LearningPortalLink $portalLink): void
    {
        $this->ensurePortalLinkBelongsToWorld($world, $portalLink);
        $portalLink->delete();
    }

    private function worldNodeOrFail(LearningWorld $world, int $nodeId): LearningNode
    {
        return LearningNode::query()
            ->whereIn('learning_map_id', $world->maps->pluck('id'))
            ->findOrFail($nodeId);
    }

    private function ensureLinkDoesNotExist(LearningNode $sourceNode, LearningNode $targetNode): void
    {
        if (LearningPortalLink::query()
            ->where('source_learning_node_id', $sourceNode->id)
            ->where('target_learning_node_id', $targetNode->id)
            ->exists()) {
            throw ValidationException::withMessages([
                'target_learning_node_id' => 'These two portal tiles are already linked.',
            ]);
        }
    }

    private function ensurePortalLinkBelongsToWorld(LearningWorld $world, LearningPortalLink $portalLink): void
    {
        $mapIds = $world->maps->pluck('id');
        $portalLink->loadMissing('sourceNode', 'targetNode');

        if (
            ! $mapIds->contains($portalLink->sourceNode->learning_map_id)
            && ! $mapIds->contains($portalLink->targetNode->learning_map_id)
        ) {
            abort(404);
        }
    }
}
