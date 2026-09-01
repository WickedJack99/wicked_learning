<?php

namespace App\Learning\Validation;

use App\Learning\Services\ReusableMediaAssetManager;
use App\Models\LearningMap;
use App\Models\LearningTopic;
use App\Models\LearningWorld;
use Illuminate\Http\UploadedFile;
use JsonException;

class LearningMapExportValidator
{
    private const MAX_ERRORS = 30;

    private const MAX_NODES = 500;

    private const MAX_ASSETS = 2000;

    public function __construct(private readonly ReusableMediaAssetManager $mediaAssetManager) {}

    /**
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, world: array{slug: string|null, exists: bool}, map: array{slug: string|null, exists: bool}}
     */
    public function validate(UploadedFile $manifest): array
    {
        $contents = $manifest->get();

        if ($contents === false) {
            return $this->invalid('The selected file could not be read.');
        }

        try {
            $payload = json_decode(
                $contents,
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            return $this->invalid('The selected file is not valid JSON.');
        }

        if (! is_array($payload)) {
            return $this->invalid('The export must contain a JSON object.');
        }

        return $this->validatePayload($payload);
    }

    /**
     * Validate a standalone MapAsset export before it is added to a map.
     *
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, world: array{slug: string|null, exists: bool}, map: array{slug: string|null, exists: bool}}
     */
    public function validateAsset(UploadedFile $manifest): array
    {
        $contents = $manifest->get();

        if ($contents === false) {
            return $this->invalid('The selected file could not be read.');
        }

        try {
            $payload = json_decode(
                $contents,
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            return $this->invalid('The selected file is not valid JSON.');
        }

        if (! is_array($payload)) {
            return $this->invalid('The export must contain a JSON object.');
        }

        return $this->validateAssetPayload($payload);
    }

    /**
     * Validate a decoded standalone MapAsset export using the existing
     * single-map graph checks.
     *
     * @param  array<string, mixed>  $payload
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, world: array{slug: string|null, exists: bool}, map: array{slug: string|null, exists: bool}}
     */
    public function validateAssetPayload(array $payload): array
    {
        $errors = [];
        $this->requireValue($payload, 'format', 'wicked-learning-map-asset', $errors);
        $this->requireValue($payload, 'formatVersion', 1, $errors);

        $source = $this->object($payload['source'] ?? null, 'source', $errors);
        $world = $this->object($source['world'] ?? null, 'source.world', $errors);
        $map = $this->object($source['map'] ?? null, 'source.map', $errors);
        $this->slug($world['slug'] ?? null, 'source.world.slug', $errors);
        $mapSlug = $this->slug($map['slug'] ?? null, 'source.map.slug', $errors);

        if (! is_numeric($source['assetId'] ?? null) || (int) $source['assetId'] <= 0) {
            $this->addError($errors, 'source.assetId must be a positive integer.');
        }

        $node = $payload['node'] ?? null;
        if ($node !== null && ! is_array($node)) {
            $this->addError($errors, 'node must be an object or null.');
            $node = null;
        }

        $asset = $this->object($payload['mapAsset'] ?? null, 'mapAsset', $errors);
        if (! is_numeric($asset['sourceId'] ?? null) || (int) $asset['sourceId'] <= 0) {
            $this->addError($errors, 'mapAsset.sourceId must be a positive integer.');
        }

        if (
            is_numeric($source['assetId'] ?? null)
            && is_numeric($asset['sourceId'] ?? null)
            && (int) $source['assetId'] !== (int) $asset['sourceId']
        ) {
            $this->addError($errors, 'source.assetId must match mapAsset.sourceId.');
        }

        if ($node === null && ($asset['nodeSlug'] ?? null) !== null) {
            $this->addError($errors, 'mapAsset.nodeSlug must be null when node is null.');
        }

        if ($errors !== []) {
            return $this->invalid(implode(' ', $errors));
        }

        return $this->validatePayload([
            'format' => 'wicked-learning-map',
            'formatVersion' => 1,
            'world' => $world,
            'map' => [
                'slug' => $mapSlug,
                'title' => $map['title'] ?? $mapSlug,
            ],
            'nodes' => $node === null ? [] : [$node],
            'mapAssets' => [$asset],
            'portalTargets' => [],
            'references' => $payload['references'] ?? [],
        ]);
    }

    /**
     * Validate a decoded single-map export payload.
     *
     * @param  array<string, mixed>  $payload
     * @return array{valid: bool, summary: string, errors: list<string>, warnings: list<string>, counts: array{nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, world: array{slug: string|null, exists: bool}, map: array{slug: string|null, exists: bool}}
     */
    public function validatePayload(array $payload): array
    {
        $errors = [];
        $warnings = [];
        $this->requireValue($payload, 'format', 'wicked-learning-map', $errors);
        $this->requireValue($payload, 'formatVersion', 1, $errors);

        $worldPayload = $this->object($payload['world'] ?? null, 'world', $errors);
        $mapPayload = $this->object($payload['map'] ?? null, 'map', $errors);
        $worldSlug = $this->slug($worldPayload['slug'] ?? null, 'world.slug', $errors);
        $mapSlug = $this->slug($mapPayload['slug'] ?? null, 'map.slug', $errors);
        $topicSlug = null;
        $world = null;
        $worldExists = false;
        $mapExists = false;

        if ($worldSlug !== null) {
            $world = LearningWorld::query()->where('slug', $worldSlug)->first();
            $worldExists = $world !== null;

            if (! $world) {
                $this->addError($errors, "World '{$worldSlug}' is not available in this workspace.");
            }

            if ($world && $mapSlug !== null) {
                $mapExists = LearningMap::query()
                    ->where('learning_world_id', $world->id)
                    ->where('slug', $mapSlug)
                    ->exists();

                if ($mapExists) {
                    $warnings[] = "Map '{$mapSlug}' already exists in this world; a future import will need an explicit conflict choice.";
                }
            }
        }

        if (array_key_exists('topicSlug', $mapPayload) && $mapPayload['topicSlug'] !== null) {
            $topicSlug = $this->slug($mapPayload['topicSlug'], 'map.topicSlug', $errors);

            if ($topicSlug !== null && ! LearningTopic::query()->where('slug', $topicSlug)->exists()) {
                $this->addError($errors, "Topic '{$topicSlug}' is not available in this workspace.");
            }
        }

        $nodes = $this->list($payload['nodes'] ?? null, 'nodes', self::MAX_NODES, $errors);
        $nodeSlugs = [];
        $activitySlugs = [];
        $activityCount = 0;

        foreach ($nodes as $index => $node) {
            $path = "nodes.{$index}";
            $nodeSlug = $this->slug($node['slug'] ?? null, "{$path}.slug", $errors);

            if ($nodeSlug !== null) {
                if (isset($nodeSlugs[$nodeSlug])) {
                    $this->addError($errors, "Duplicate node slug '{$nodeSlug}'.");
                }
                $nodeSlugs[$nodeSlug] = true;
            }

            $activities = $this->list($node['activities'] ?? null, "{$path}.activities", 100, $errors);
            $activitySlugs[$nodeSlug ?? "#{$index}"] = [];
            $activityKey = $nodeSlug ?? "#{$index}";

            foreach ($activities as $activityIndex => $activity) {
                $activityPath = "{$path}.activities.{$activityIndex}";
                $activitySlug = $this->slug($activity['slug'] ?? null, "{$activityPath}.slug", $errors);

                if ($activitySlug !== null) {
                    if (isset($activitySlugs[$activityKey][$activitySlug])) {
                        $this->addError($errors, "Duplicate activity slug '{$activitySlug}' in node '{$nodeSlug}'.");
                    }
                    $activitySlugs[$activityKey][$activitySlug] = true;
                }

                if (! is_string($activity['type'] ?? null) || trim($activity['type']) === '') {
                    $this->addError($errors, "{$activityPath}.type must be a non-empty string.");
                }

                if (! is_string($activity['title'] ?? null) || trim($activity['title']) === '') {
                    $this->addError($errors, "{$activityPath}.title must be a non-empty string.");
                }

                $activityCount++;
            }

            foreach ($activities as $activityIndex => $activity) {
                $activityPath = "{$path}.activities.{$activityIndex}";

                foreach ($this->list($activity['transitions'] ?? null, "{$activityPath}.transitions", 100, $errors) as $transitionIndex => $transition) {
                    $targetSlug = $transition['toActivitySlug'] ?? null;

                    if (! is_string($targetSlug) || ! isset($activitySlugs[$activityKey][$targetSlug])) {
                        $this->addError($errors, "{$activityPath}.transitions.{$transitionIndex}.toActivitySlug must name an activity in the same node.");
                    }
                }
            }

            if (
                isset($node['startActivitySlug'])
                && (! is_string($node['startActivitySlug']) || ! isset($activitySlugs[$activityKey][$node['startActivitySlug']]))
            ) {
                $this->addError($errors, "{$path}.startActivitySlug must name an activity in the same node.");
            }

            foreach ($this->list($node['activityStarts'] ?? null, "{$path}.activityStarts", 100, $errors) as $startIndex => $start) {
                $startSlug = $start['activitySlug'] ?? null;

                if ($startSlug !== null && (! is_string($startSlug) || ! isset($activitySlugs[$activityKey][$startSlug]))) {
                    $this->addError($errors, "{$path}.activityStarts.{$startIndex}.activitySlug must name an activity in the same node.");
                }
            }
        }

        $assets = $this->list($payload['mapAssets'] ?? null, 'mapAssets', self::MAX_ASSETS, $errors);
        foreach ($assets as $index => $asset) {
            $assetNodeSlug = $asset['nodeSlug'] ?? null;

            if ($assetNodeSlug !== null && (! is_string($assetNodeSlug) || ! isset($nodeSlugs[$assetNodeSlug]))) {
                $this->addError($errors, "mapAssets.{$index}.nodeSlug must name an exported node.");
            }
        }

        $portalTargets = $this->list($payload['portalTargets'] ?? null, 'portalTargets', self::MAX_ASSETS, $errors);
        $externalMapSlugs = collect($portalTargets)
            ->map(fn (array $portal): mixed => $portal['targetMapSlug'] ?? null)
            ->filter(fn (mixed $slug): bool => is_string($slug) && $slug !== $mapSlug)
            ->unique()
            ->values();
        $externalMaps = $world && $externalMapSlugs->isNotEmpty()
            ? LearningMap::query()
                ->with('nodes.activities')
                ->where('learning_world_id', $world->id)
                ->whereIn('slug', $externalMapSlugs->all())
                ->get()
                ->keyBy('slug')
            : collect();

        foreach ($portalTargets as $index => $portal) {
            $sourceNodeSlug = $portal['sourceNodeSlug'] ?? null;

            if (! is_string($sourceNodeSlug) || ! isset($nodeSlugs[$sourceNodeSlug])) {
                $this->addError($errors, "portalTargets.{$index}.sourceNodeSlug must name an exported node.");

                continue;
            }

            $sourceActivitySlug = $portal['sourceActivitySlug'] ?? null;
            if ($sourceActivitySlug !== null && (! is_string($sourceActivitySlug) || ! isset($activitySlugs[$sourceNodeSlug][$sourceActivitySlug]))) {
                $this->addError($errors, "portalTargets.{$index}.sourceActivitySlug must name an activity in its source node.");
            }

            $targetMapSlug = $this->slug($portal['targetMapSlug'] ?? null, "portalTargets.{$index}.targetMapSlug", $errors);
            $targetNodeSlug = $this->slug($portal['targetNodeSlug'] ?? null, "portalTargets.{$index}.targetNodeSlug", $errors);

            if ($targetMapSlug === null || $targetNodeSlug === null) {
                continue;
            }

            $targetActivitySlugs = [];
            if ($targetMapSlug === $mapSlug) {
                if (! isset($nodeSlugs[$targetNodeSlug])) {
                    $this->addError($errors, "portalTargets.{$index}.targetNodeSlug must name an exported node.");
                } else {
                    $targetActivitySlugs = array_keys($activitySlugs[$targetNodeSlug] ?? []);
                }
            } else {
                $targetMap = $externalMaps->get($targetMapSlug);
                $targetNode = $targetMap?->nodes->firstWhere('slug', $targetNodeSlug);

                if ($targetMap === null) {
                    $this->addError($errors, "portalTargets.{$index}.targetMapSlug must name a map in this workspace.");
                } elseif ($targetNode === null) {
                    $this->addError($errors, "portalTargets.{$index}.targetNodeSlug must name a node in the target map.");
                } else {
                    $targetActivitySlugs = $targetNode->activities->pluck('slug')->all();
                }
            }

            $targetActivitySlug = $portal['targetActivitySlug'] ?? null;
            if ($targetActivitySlug !== null && (! is_string($targetActivitySlug) || ! in_array($targetActivitySlug, $targetActivitySlugs, true))) {
                $this->addError($errors, "portalTargets.{$index}.targetActivitySlug must name an activity in the target node.");
            }
        }

        $references = $this->object($payload['references'] ?? null, 'references', $errors);
        $mediaReferences = $this->values($references['mediaUrls'] ?? null, 'references.mediaUrls', self::MAX_ASSETS, $errors);
        foreach ($mediaReferences as $index => $reference) {
            if (! is_string($reference) || trim($reference) === '') {
                $this->addError($errors, "references.mediaUrls.{$index} must be a non-empty string.");
            } elseif (! $this->mediaAssetManager->isImportableReference($reference)) {
                $this->addError($errors, "references.mediaUrls.{$index} must point to an available local media asset.");
            }
        }

        $declaredMediaReferences = array_fill_keys(
            array_values(array_filter($mediaReferences, 'is_string')),
            true,
        );
        foreach ($this->collectMediaUrls($payload) as $reference) {
            if (! isset($declaredMediaReferences[$reference])) {
                $this->addError($errors, 'references.mediaUrls must include every media reference used by the manifest.');

                break;
            }
        }

        $counts = [
            'nodes' => count($nodes),
            'activities' => $activityCount,
            'mapAssets' => count($assets),
            'portalTargets' => count($portalTargets),
            'mediaReferences' => count($mediaReferences),
        ];

        return [
            'valid' => $errors === [],
            'summary' => $errors === []
                ? 'The manifest is structurally valid and ready to import.'
                : 'The manifest needs corrections before it can be imported.',
            'errors' => $errors,
            'warnings' => array_values(array_unique($warnings)),
            'counts' => $counts,
            'world' => ['slug' => $worldSlug, 'exists' => $worldExists],
            'map' => ['slug' => $mapSlug, 'exists' => $mapExists],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $errors
     */
    private function requireValue(array $payload, string $key, mixed $expected, array &$errors): void
    {
        if (($payload[$key] ?? null) !== $expected) {
            $this->addError($errors, "{$key} must be ".json_encode($expected).'.');
        }
    }

    /**
     * @param  list<string>  $errors
     * @return array<string, mixed>
     */
    private function object(mixed $value, string $path, array &$errors): array
    {
        if (! is_array($value)) {
            $this->addError($errors, "{$path} must be an object.");

            return [];
        }

        return $value;
    }

    /**
     * @param  list<string>  $errors
     * @return list<array<string, mixed>>
     */
    private function list(mixed $value, string $path, int $max, array &$errors): array
    {
        if ($value === null) {
            return [];
        }

        if (! is_array($value) || ! array_is_list($value)) {
            $this->addError($errors, "{$path} must be an array.");

            return [];
        }

        if (count($value) > $max) {
            $this->addError($errors, "{$path} contains more than {$max} entries.");
        }

        $items = [];
        foreach (array_slice($value, 0, $max) as $index => $item) {
            if (! is_array($item)) {
                $this->addError($errors, "{$path}.{$index} must be an object.");

                continue;
            }

            $items[] = $item;
        }

        return $items;
    }

    /**
     * @param  list<string>  $errors
     * @return list<mixed>
     */
    private function values(mixed $value, string $path, int $max, array &$errors): array
    {
        if ($value === null) {
            return [];
        }

        if (! is_array($value) || ! array_is_list($value)) {
            $this->addError($errors, "{$path} must be an array.");

            return [];
        }

        if (count($value) > $max) {
            $this->addError($errors, "{$path} contains more than {$max} entries.");
        }

        return array_slice($value, 0, $max);
    }

    /**
     * @param  list<string>  $errors
     */
    private function slug(mixed $value, string $path, array &$errors): ?string
    {
        if (! is_string($value) || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $value) !== 1) {
            $this->addError($errors, "{$path} must be a lowercase slug.");

            return null;
        }

        return $value;
    }

    /** @param list<string> $errors */
    private function addError(array &$errors, string $message): void
    {
        if (count($errors) < self::MAX_ERRORS) {
            $errors[] = $message;
        }
    }

    /**
     * @return list<string>
     */
    private function collectMediaUrls(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $urls = [];

        foreach ($value as $key => $nestedValue) {
            if (
                is_string($nestedValue)
                && $this->isMediaKey((string) $key)
                && trim($nestedValue) !== ''
            ) {
                $urls[] = $nestedValue;
            }

            if (is_array($nestedValue)) {
                $urls = array_merge($urls, $this->collectMediaUrls($nestedValue));
            }
        }

        return array_values(array_unique($urls));
    }

    private function isMediaKey(string $key): bool
    {
        $normalizedKey = strtolower(str_replace(['_', '-'], '', $key));

        return str_ends_with($normalizedKey, 'url')
            || str_contains($normalizedKey, 'image')
            || str_contains($normalizedKey, 'sound')
            || str_contains($normalizedKey, 'audio')
            || $normalizedKey === 'src';
    }

    /**
     * @return array{valid: false, summary: string, errors: list<string>, warnings: list<string>, counts: array{nodes: int, activities: int, mapAssets: int, portalTargets: int, mediaReferences: int}, world: array{slug: null, exists: false}, map: array{slug: null, exists: false}}
     */
    private function invalid(string $message): array
    {
        return [
            'valid' => false,
            'summary' => 'The manifest could not be checked.',
            'errors' => [$message],
            'warnings' => [],
            'counts' => [
                'nodes' => 0,
                'activities' => 0,
                'mapAssets' => 0,
                'portalTargets' => 0,
                'mediaReferences' => 0,
            ],
            'world' => ['slug' => null, 'exists' => false],
            'map' => ['slug' => null, 'exists' => false],
        ];
    }
}
