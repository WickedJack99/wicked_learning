<?php

namespace Tests\Feature;

use App\Learning\Actions\CreateLearningMapAsset;
use App\Learning\Actions\CreateLearningNode;
use App\Learning\Actions\UpdateLearningMapAsset;
use App\Learning\MapAssetInteractionMode;
use App\Learning\Validation\AdminWorldRules;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
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
                'imageFit' => 'cover',
                'imagePosition' => 'top',
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
        $this->assertSame(
            'cover',
            LearningMapAsset::query()->findOrFail($asset->id)->visual_config['imageFit'],
        );
        $this->assertSame(
            'top',
            LearningMapAsset::query()->findOrFail($asset->id)->visual_config['imagePosition'],
        );
    }

    public function test_image_framing_rules_reject_unknown_values(): void
    {
        [$map] = $this->mapAndNode();
        $validator = Validator::make([
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
            'opacity' => 1,
            'visual_config' => [
                'imageFit' => 'stretch',
                'imagePosition' => 'upper-left',
            ],
        ], app(AdminWorldRules::class)->mapAsset($map));

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey(
            'visual_config.imageFit',
            $validator->errors()->toArray(),
        );
        $this->assertArrayHasKey(
            'visual_config.imagePosition',
            $validator->errors()->toArray(),
        );
    }

    public function test_interaction_mode_controls_focus_and_persists_toggle_sprites(): void
    {
        [$map] = $this->mapAndNode();
        $asset = app(CreateLearningMapAsset::class)->handle($map, [
            'interaction_mode' => MapAssetInteractionMode::Toggle->value,
            'interaction_config' => [
                'states' => [
                    'first' => [
                        'imageUrl' => '/storage/hood-closed.webp',
                        'x' => 48,
                        'y' => 42,
                        'width' => 30,
                    ],
                    'second' => [
                        'imageUrl' => '/storage/hood-open.webp',
                        'x' => 51,
                        'y' => 31,
                        'width' => 34,
                    ],
                ],
            ],
        ]);

        $this->assertFalse($asset->focusable);
        $this->assertSame('toggle', $asset->interaction_mode);
        $this->assertSame(
            '/storage/hood-open.webp',
            $asset->interaction_config['states']['second']['imageUrl'],
        );

        $asset = app(UpdateLearningMapAsset::class)->handle($asset, [
            'interaction_mode' => MapAssetInteractionMode::Focusable->value,
        ]);

        $this->assertTrue($asset->focusable);
        $this->assertSame('focusable', $asset->interaction_mode);
    }

    public function test_toggle_mode_requires_two_complete_state_sprites(): void
    {
        [$map] = $this->mapAndNode();
        $validator = Validator::make([
            'interaction_mode' => 'toggle',
            'interaction_config' => [
                'states' => [
                    'first' => ['x' => 50, 'y' => 50, 'width' => 20],
                    'second' => [
                        'imageUrl' => '/storage/open.webp',
                        'x' => 50,
                        'y' => 50,
                        'width' => 20,
                    ],
                ],
            ],
            'opacity' => 1,
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 20,
        ], app(AdminWorldRules::class)->mapAsset($map));

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey(
            'interaction_config.states.first.imageUrl',
            $validator->errors()->toArray(),
        );
    }

    public function test_normal_mode_accepts_empty_inactive_state_sprites(): void
    {
        [$map] = $this->mapAndNode();
        $validator = Validator::make([
            'interaction_mode' => 'focusable',
            'interaction_config' => [
                'states' => [
                    'first' => [
                        'imageUrl' => null,
                        'x' => 50,
                        'y' => 50,
                        'width' => 14,
                    ],
                    'second' => [
                        'imageUrl' => null,
                        'x' => 50,
                        'y' => 50,
                        'width' => 14,
                    ],
                ],
            ],
            'opacity' => 1,
            'position_x' => 50,
            'position_y' => 50,
            'position_z' => 0,
            'width' => 14,
        ], app(AdminWorldRules::class)->mapAsset($map));

        $this->assertFalse($validator->fails(), $validator->errors()->toJson());
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
