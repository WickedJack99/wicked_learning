<?php

namespace App\Learning\Support;

use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Support\Str;

class UniqueSlugGenerator
{
    public function forActivity(
        LearningNode $node,
        string $title,
        ?LearningActivity $existingActivity = null,
    ): string {
        $baseSlug = Str::slug($title) ?: 'activity';
        $slug = $baseSlug;
        $suffix = 2;

        while ($this->activitySlugExists($node, $slug, $existingActivity)) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forMap(LearningWorld $world, string $title): string
    {
        $baseSlug = Str::slug($title) ?: 'map';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningMap::query()
            ->where('learning_world_id', $world->id)
            ->where('slug', $slug)
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forNode(
        LearningMap $map,
        string $title,
        ?LearningNode $existingNode = null,
    ): string {
        $baseSlug = Str::slug($title) ?: 'node';
        $slug = $baseSlug;
        $suffix = 2;

        while ($this->nodeSlugExists($map, $slug, $existingNode)) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function activitySlugExists(
        LearningNode $node,
        string $slug,
        ?LearningActivity $existingActivity,
    ): bool {
        return LearningActivity::query()
            ->where('learning_node_id', $node->id)
            ->where('slug', $slug)
            ->when($existingActivity, fn ($query) => $query->whereKeyNot($existingActivity->id))
            ->exists();
    }

    private function nodeSlugExists(
        LearningMap $map,
        string $slug,
        ?LearningNode $existingNode,
    ): bool {
        return LearningNode::query()
            ->where('learning_map_id', $map->id)
            ->where('slug', $slug)
            ->when($existingNode, fn ($query) => $query->whereKeyNot($existingNode->id))
            ->exists();
    }
}
