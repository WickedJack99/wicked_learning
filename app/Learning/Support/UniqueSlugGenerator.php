<?php

namespace App\Learning\Support;

use App\Models\AiAgentTemplate;
use App\Models\LearningActivity;
use App\Models\LearningGroup;
use App\Models\LearningItem;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTool;
use App\Models\LearningWorld;
use App\Models\Organization;
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

    public function forTool(string $title, ?LearningTool $existingTool = null): string
    {
        $baseSlug = Str::slug($title) ?: 'tool';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningTool::query()
            ->where('slug', $slug)
            ->when($existingTool, fn ($query) => $query->whereKeyNot($existingTool->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forItem(string $title, ?LearningItem $existingItem = null): string
    {
        $baseSlug = Str::slug($title) ?: 'item';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningItem::query()
            ->where('slug', $slug)
            ->when($existingItem, fn ($query) => $query->whereKeyNot($existingItem->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forAiAgentTemplate(string $title, ?AiAgentTemplate $existingTemplate = null): string
    {
        $baseSlug = Str::slug($title) ?: 'ai-agent';
        $slug = $baseSlug;
        $suffix = 2;

        while (AiAgentTemplate::query()
            ->where('slug', $slug)
            ->when($existingTemplate, fn ($query) => $query->whereKeyNot($existingTemplate->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forLearningGroup(string $title, ?LearningGroup $existingGroup = null): string
    {
        $baseSlug = Str::slug($title) ?: 'group';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningGroup::query()
            ->where('slug', $slug)
            ->when($existingGroup, fn ($query) => $query->whereKeyNot($existingGroup->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function forOrganization(string $title, ?Organization $existingOrganization = null): string
    {
        $baseSlug = Str::slug($title) ?: 'organization';
        $slug = $baseSlug;
        $suffix = 2;

        while (Organization::query()
            ->where('slug', $slug)
            ->when($existingOrganization, fn ($query) => $query->whereKeyNot($existingOrganization->id))
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
