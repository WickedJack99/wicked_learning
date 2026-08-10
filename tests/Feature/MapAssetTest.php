<?php

namespace Tests\Feature;

use App\Learning\Actions\CreateLearningMapAsset;
use App\Learning\Actions\CreateLearningNode;
use App\Learning\Actions\UpdateLearningMapAsset;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MapAssetTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_node_can_have_only_one_map_asset(): void
    {
        [$map, $node] = $this->mapAndNode();

        LearningMapAsset::query()->create([
            'learning_map_id' => $map->id,
            'learning_node_id' => $node->id,
        ]);

        $this->expectException(QueryException::class);
        LearningMapAsset::query()->create([
            'learning_map_id' => $map->id,
            'learning_node_id' => $node->id,
        ]);
    }

    public function test_deleting_a_map_asset_does_not_delete_its_node(): void
    {
        [$map, $node] = $this->mapAndNode();
        $asset = LearningMapAsset::query()->create([
            'learning_map_id' => $map->id,
            'learning_node_id' => $node->id,
        ]);

        $asset->delete();

        $this->assertDatabaseMissing('learning_map_assets', ['id' => $asset->id]);
        $this->assertDatabaseHas('learning_nodes', ['id' => $node->id]);
    }

    public function test_creating_a_node_creates_its_map_asset_placeholder(): void
    {
        $world = LearningWorld::query()->create([
            'slug' => 'test-world',
            'title' => 'Test world',
        ]);
        $map = $world->maps()->create([
            'slug' => 'test-map',
            'title' => 'Test map',
        ]);

        $node = app(CreateLearningNode::class)->handle($map, [
            'title' => 'New node',
            'description' => 'A node created in the editor.',
            'state' => 'active',
            'position_q' => 0,
            'position_r' => 0,
            'visual_config' => [],
        ]);

        $this->assertDatabaseHas('learning_map_assets', [
            'learning_map_id' => $map->id,
            'learning_node_id' => $node->id,
            'position_x' => 50,
            'position_y' => 50,
            'width' => 14,
        ]);
    }

    public function test_creating_a_map_asset_creates_its_learning_node_automatically(): void
    {
        [$map] = $this->mapAndNode();

        $asset = app(CreateLearningMapAsset::class)->handle($map, [
            'text' => 'Heart valve',
            'focusable' => true,
        ]);

        $this->assertNotNull($asset->learning_node_id);
        $this->assertDatabaseHas('learning_nodes', [
            'id' => $asset->learning_node_id,
            'learning_map_id' => $map->id,
            'title' => 'Heart valve',
        ]);
    }

    public function test_map_asset_surface_and_visual_settings_are_persisted(): void
    {
        [$map] = $this->mapAndNode();
        $asset = LearningMapAsset::query()->create([
            'learning_map_id' => $map->id,
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'locked' => false,
            'focusable' => true,
            'visual_config' => [],
            'sound_config' => [],
        ]);

        app(UpdateLearningMapAsset::class)->handle($asset, [
            'position_y' => 61,
            'width' => 18,
            'visual_config' => [
                'dark' => [
                    'borderColor' => '#123456',
                    'highlightImageEnabled' => true,
                    'highlightImageUrl' => '/storage/learning/nodes/highlight.webp',
                ],
            ],
        ]);

        $this->assertDatabaseHas('learning_map_assets', [
            'id' => $asset->id,
            'position_y' => 61,
            'width' => 18,
        ]);
        $this->assertSame(
            '#123456',
            LearningMapAsset::query()->findOrFail($asset->id)->visual_config['dark']['borderColor'],
        );
        $this->assertTrue(
            LearningMapAsset::query()->findOrFail($asset->id)->visual_config['dark']['highlightImageEnabled'],
        );
        $this->assertSame(
            '/storage/learning/nodes/highlight.webp',
            LearningMapAsset::query()->findOrFail($asset->id)->visual_config['dark']['highlightImageUrl'],
        );
    }

    /** @return array{0: LearningMap, 1: LearningNode} */
    private function mapAndNode(): array
    {
        $world = LearningWorld::query()->create([
            'slug' => 'test-world',
            'title' => 'Test world',
        ]);
        $map = $world->maps()->create([
            'slug' => 'test-map',
            'title' => 'Test map',
        ]);
        $node = $map->nodes()->create([
            'slug' => 'test-node',
            'title' => 'Test node',
            'state' => 'active',
            'position_q' => 0,
            'position_r' => 0,
        ]);

        return [$map, $node];
    }
}
