<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use Illuminate\Validation\ValidationException;

class PortalLinkService
{
    public function syncForActivity(LearningActivity $activity, mixed $targetActivityId): void
    {
        $activity->loadMissing('node.map.world');

        if ($this->shouldRemoveLink($activity, $targetActivityId)) {
            $this->deleteActivityLink($activity);

            return;
        }

        $targetActivity = $this->targetActivityOrFail($activity, (int) $targetActivityId);
        $this->updateLink($activity, $targetActivity);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function candidatesForNode(LearningNode $node): array
    {
        $node->loadMissing('map.world.maps.nodes.activities');
        $mapIds = $node->map->world->maps->pluck('id');

        return LearningActivity::query()
            ->with('node.map')
            ->where('type', 'portal')
            ->whereIn('learning_node_id', LearningNode::query()->select('id')->whereIn('learning_map_id', $mapIds))
            ->orderBy('title')
            ->get()
            ->filter(fn (LearningActivity $activity): bool => $this->portalModeFor($activity) === 'input')
            ->values()
            ->map(fn (LearningActivity $activity): array => $this->candidateSummary($activity))
            ->all();
    }

    public function portalModeFor(LearningActivity $activity): string
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return ($config['portalMode'] ?? 'output') === 'input' ? 'input' : 'output';
    }

    private function shouldRemoveLink(LearningActivity $activity, mixed $targetActivityId): bool
    {
        return $activity->type !== 'portal'
            || $this->portalModeFor($activity) !== 'output'
            || ! $targetActivityId;
    }

    private function deleteActivityLink(LearningActivity $activity): void
    {
        LearningPortalLink::query()
            ->where('source_learning_activity_id', $activity->id)
            ->delete();
    }

    private function targetActivityOrFail(LearningActivity $sourceActivity, int $targetActivityId): LearningActivity
    {
        $sourceActivity->loadMissing('node.map.world.maps');
        $mapIds = $sourceActivity->node->map->world->maps->pluck('id');

        $targetActivity = LearningActivity::query()
            ->with('node.map')
            ->whereKey($targetActivityId)
            ->where('type', 'portal')
            ->whereHas('node', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->firstOrFail();

        if ($this->portalModeFor($targetActivity) !== 'input') {
            throw ValidationException::withMessages([
                'target_portal_activity_id' => 'Choose an exit portal activity as the travel target.',
            ]);
        }

        return $targetActivity;
    }

    private function updateLink(LearningActivity $activity, LearningActivity $targetActivity): void
    {
        LearningPortalLink::query()->updateOrCreate(
            ['source_learning_activity_id' => $activity->id],
            [
                'source_learning_node_id' => $activity->learning_node_id,
                'target_learning_node_id' => $targetActivity->learning_node_id,
                'target_learning_activity_id' => $targetActivity->id,
                'label' => "{$activity->title} to {$targetActivity->title}",
                'description' => "Travel from {$activity->node->title} to {$targetActivity->node->title}.",
                'config' => ['travelMode' => 'portal'],
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function candidateSummary(LearningActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'nodeId' => $activity->node->id,
            'nodeTitle' => $activity->node->title,
            'mapId' => $activity->node->map->id,
            'mapTitle' => $activity->node->map->title,
        ];
    }
}
