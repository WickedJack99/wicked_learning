<?php

namespace App\Learning\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningWorld;
use Illuminate\Support\Facades\DB;
use LogicException;

class ImportLearningMapAsset
{
    public function __construct(
        private readonly ImportLearningMap $mapImporter,
        private readonly UniqueSlugGenerator $slugGenerator,
    ) {}

    /**
     * Import one validated standalone asset into an existing authored map.
     * Learner state, portals, permissions and revision history are not part of
     * the standalone transfer boundary.
     *
     * @param  array<string, mixed>  $payload
     */
    public function handle(array $payload, LearningWorld $world, LearningMap $map): LearningMapAsset
    {
        return DB::transaction(function () use ($map, $payload, $world): LearningMapAsset {
            $node = is_array($payload['node'] ?? null) ? $payload['node'] : null;
            $asset = is_array($payload['mapAsset'] ?? null) ? $payload['mapAsset'] : [];

            if ($node !== null) {
                $node['slug'] = $this->slugGenerator->forNode(
                    $map,
                    trim((string) ($node['title'] ?? $node['slug'] ?? 'Imported place')),
                );
                $node['position'] = $this->availableNodePosition($map, $node);
                $asset['nodeSlug'] = $node['slug'];
            } else {
                $asset['nodeSlug'] = null;
            }

            $context = $this->mapImporter->populateMap([
                'nodes' => $node === null ? [] : [$node],
                'mapAssets' => [$asset],
                'portalTargets' => [],
            ], $world, $map, [], false);

            $sourceAssetId = is_numeric($asset['sourceId'] ?? null)
                ? (int) $asset['sourceId']
                : null;
            $importedAssetId = $sourceAssetId === null
                ? null
                : ($context['assetIds']['#'.$sourceAssetId] ?? null);

            if ($importedAssetId === null) {
                throw new LogicException('The standalone asset import did not create the exported asset.');
            }

            return LearningMapAsset::query()->findOrFail($importedAssetId);
        });
    }

    /**
     * Keep the source position when available, moving right until the
     * destination map has a free hex. A map import must not overwrite or
     * violate the destination map's unique grid-position constraint.
     *
     * @param  array<string, mixed>  $node
     * @return array{q: int, r: int}
     */
    private function availableNodePosition(LearningMap $map, array $node): array
    {
        $q = (int) data_get($node, 'position.q', 0);
        $r = (int) data_get($node, 'position.r', 0);

        while ($map->nodes()->where('position_q', $q)->where('position_r', $r)->exists()) {
            $q++;
        }

        return ['q' => $q, 'r' => $r];
    }
}
