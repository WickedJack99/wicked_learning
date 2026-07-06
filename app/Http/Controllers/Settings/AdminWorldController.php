<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningWorld;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminWorldController extends Controller
{
    public function index(): Response
    {
        $world = $this->demoWorldQuery()
            ->with(['maps.nodes'])
            ->firstOrFail();

        return Inertia::render('settings/worlds/index', [
            'worldGraph' => [
                'world' => $this->worldSummary($world),
                'maps' => $world->maps
                    ->values()
                    ->map(fn (LearningMap $map): array => $this->mapSummary($map))
                    ->all(),
                'portalCandidates' => $this->portalCandidatesFor($world),
                'portalLinks' => $this->portalLinksFor($world),
            ],
        ]);
    }

    public function editMap(LearningMap $map): Response
    {
        $map->loadMissing('world', 'nodes');

        return Inertia::render('settings/worlds/edit-map', [
            'editableMap' => [
                'world' => $this->worldSummary($map->world),
                'map' => [
                    ...$this->mapSummary($map),
                    'backgroundConfig' => $map->background_config ?? [],
                    'gridConfig' => $map->grid_config ?? [],
                    'nodes' => $map->nodes
                        ->sortBy([['position_q', 'asc'], ['position_r', 'asc']])
                        ->values()
                        ->map(fn (LearningNode $node): array => $this->nodeSummary($node))
                        ->all(),
                ],
            ],
        ]);
    }

    public function storeMap(Request $request): RedirectResponse
    {
        $world = $this->demoWorldQuery()
            ->with('maps')
            ->firstOrFail();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_maps', 'slug')->where('learning_world_id', $world->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $templateMap = $world->maps->first();

        LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'slug' => ($data['slug'] ?? null) ?: $this->uniqueMapSlug($world, (string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'background_config' => $templateMap->background_config ?? [],
            'grid_config' => $templateMap->grid_config ?? [],
            'time_background_enabled' => false,
        ]);

        return redirect()->route('settings.worlds.index');
    }

    public function storePortalLink(Request $request): RedirectResponse
    {
        $world = $this->demoWorldQuery()
            ->with('maps')
            ->firstOrFail();

        $data = $request->validate([
            'source_learning_node_id' => ['required', 'integer', 'different:target_learning_node_id'],
            'target_learning_node_id' => ['required', 'integer'],
            'label' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $sourceNode = $this->worldNodeOrFail($world, (int) $data['source_learning_node_id']);
        $targetNode = $this->worldNodeOrFail($world, (int) $data['target_learning_node_id']);

        if (LearningPortalLink::query()
            ->where('source_learning_node_id', $sourceNode->id)
            ->where('target_learning_node_id', $targetNode->id)
            ->exists()) {
            throw ValidationException::withMessages([
                'target_learning_node_id' => 'These two portal tiles are already linked.',
            ]);
        }

        LearningPortalLink::query()->create([
            'source_learning_node_id' => $sourceNode->id,
            'target_learning_node_id' => $targetNode->id,
            'label' => ($data['label'] ?? null) ?: "{$sourceNode->title} to {$targetNode->title}",
            'description' => $data['description'] ?? null,
            'config' => ['travelMode' => 'portal'],
        ]);

        return redirect()->route('settings.worlds.index');
    }

    public function destroyPortalLink(LearningPortalLink $portalLink): RedirectResponse
    {
        $world = $this->demoWorldQuery()
            ->with('maps')
            ->firstOrFail();

        $this->ensurePortalLinkBelongsToWorld($world, $portalLink);

        $portalLink->delete();

        return redirect()->route('settings.worlds.index');
    }

    public function uploadNodeImage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'file', 'max:5120'],
        ]);

        $image = $data['image'];

        if (! $image instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'image' => 'Please choose an image file.',
            ]);
        }

        $extension = strtolower($image->getClientOriginalExtension());
        $allowedExtensions = ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];

        if (! in_array($extension, $allowedExtensions, true)) {
            throw ValidationException::withMessages([
                'image' => 'The image must be a GIF, JPG, PNG, SVG or WEBP file.',
            ]);
        }

        $filename = Str::uuid()->toString().'.'.$extension;
        $path = $image->storeAs('learning/nodes', $filename, 'public');

        abort_if($path === false, 500, 'The image could not be stored.');

        return response()->json([
            'url' => Storage::url($path),
        ]);
    }

    public function storeNode(Request $request, LearningMap $map): RedirectResponse
    {
        $data = $request->validate($this->nodeRules($request, $map));

        $node = new LearningNode([
            'learning_map_id' => $map->id,
            'position_q' => $data['position_q'],
            'position_r' => $data['position_r'],
        ]);

        $this->fillNode($node, $map, $data);
        $node->save();

        return redirect()->route('settings.worlds.maps.edit', $map);
    }

    public function updateMap(Request $request, LearningMap $map): RedirectResponse
    {
        $data = $request->validate([
            ...$this->mapVisualRules(),
        ]);

        $map->forceFill([
            'background_config' => $this->mergeSubmittedConfig($map->background_config ?? [], $data['background_config'] ?? []),
        ])->save();

        return redirect()->route('settings.worlds.maps.edit', $map);
    }

    public function insertNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');

        $data = $request->validate([
            ...$this->nodeContentRules($node->map),
            'direction_q' => ['required', 'integer'],
            'direction_r' => ['required', 'integer'],
        ]);

        $direction = $this->validatedDirection($data);
        $insertPosition = [
            'q' => $node->position_q + $direction[0],
            'r' => $node->position_r + $direction[1],
        ];
        $neighbor = $this->nodeAt($node->map, $insertPosition['q'], $insertPosition['r']);

        if (! $neighbor) {
            throw ValidationException::withMessages([
                'direction' => 'There is no neighboring tile in that direction.',
            ]);
        }

        DB::transaction(function () use ($data, $direction, $insertPosition, $node): void {
            $this->pushNodeChain($node->map, $insertPosition['q'], $insertPosition['r'], $direction);

            $newNode = new LearningNode([
                'learning_map_id' => $node->learning_map_id,
                'position_q' => $insertPosition['q'],
                'position_r' => $insertPosition['r'],
            ]);

            $this->fillNode($newNode, $node->map, $data);
            $newNode->save();
        });

        return redirect()->route('settings.worlds.maps.edit', $node->map);
    }

    public function updateNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');

        $data = $request->validate($this->nodeRules($request, $node->map, $node));

        $node->forceFill([
            'position_q' => $data['position_q'],
            'position_r' => $data['position_r'],
        ]);

        $this->fillNode($node, $node->map, $data);
        $node->save();

        return redirect()->route('settings.worlds.maps.edit', $node->map);
    }

    public function swapNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');

        $data = $request->validate([
            'direction_q' => ['required', 'integer'],
            'direction_r' => ['required', 'integer'],
        ]);

        $direction = $this->validatedDirection($data);

        $targetNode = $this->nodeAt($node->map, $node->position_q + $direction[0], $node->position_r + $direction[1]);

        if (! $targetNode) {
            throw ValidationException::withMessages([
                'direction' => 'There is no neighboring tile in that direction.',
            ]);
        }

        $sourcePosition = [
            'q' => $node->position_q,
            'r' => $node->position_r,
        ];
        $targetPosition = [
            'q' => $targetNode->position_q,
            'r' => $targetNode->position_r,
        ];

        DB::transaction(function () use ($node, $sourcePosition, $targetNode, $targetPosition): void {
            $temporaryOffset = 100000;

            $node->forceFill([
                'position_q' => $sourcePosition['q'] + $temporaryOffset,
                'position_r' => $sourcePosition['r'] + $temporaryOffset,
            ])->save();

            $targetNode->forceFill([
                'position_q' => $sourcePosition['q'],
                'position_r' => $sourcePosition['r'],
            ])->save();

            $node->forceFill([
                'position_q' => $targetPosition['q'],
                'position_r' => $targetPosition['r'],
            ])->save();
        });

        return redirect()->route('settings.worlds.maps.edit', $node->map);
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeRules(Request $request, LearningMap $map, ?LearningNode $node = null): array
    {
        return [
            ...$this->nodeContentRules($map, $node),
            'position_q' => [
                'required',
                'integer',
                Rule::unique('learning_nodes', 'position_q')
                    ->where('learning_map_id', $map->id)
                    ->where('position_r', $request->integer('position_r'))
                    ->ignore($node?->id),
            ],
            'position_r' => ['required', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeContentRules(LearningMap $map, ?LearningNode $node = null): array
    {
        $themeVisualRules = [];

        foreach (['dark', 'light'] as $mode) {
            $themeVisualRules["visual_config.{$mode}.tileColor"] = ['nullable', 'string', 'max:40'];
            $themeVisualRules["visual_config.{$mode}.foregroundColor"] = ['nullable', 'string', 'max:40'];
            $themeVisualRules["visual_config.{$mode}.labelColor"] = ['nullable', 'string', 'max:40'];
            $themeVisualRules["visual_config.{$mode}.highlightColor"] = ['nullable', 'string', 'max:40'];
            $themeVisualRules["visual_config.{$mode}.imageUrl"] = ['nullable', 'string', 'max:2048'];
        }

        return [
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_nodes', 'slug')
                    ->where('learning_map_id', $map->id)
                    ->ignore($node?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'state' => ['required', 'string', Rule::in(['active', 'available', 'completed', 'hidden', 'hinted', 'locked', 'recommended'])],
            'visual_config.label' => ['nullable', 'string', 'max:80'],
            'visual_config.hideEmptySpace' => ['nullable', 'boolean'],
            'visual_config.hideImage' => ['nullable', 'boolean'],
            'visual_config.hideLabel' => ['nullable', 'boolean'],
            'visual_config.tooltip' => ['nullable', 'string', 'max:255'],
            ...$themeVisualRules,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapVisualRules(): array
    {
        $rules = [];
        $colorFields = [
            'accentColor',
            'overlay',
            'pageBackground',
            'panelBackground',
            'panelMutedTextColor',
            'panelTextColor',
            'sidePanelBackground',
            'sidePanelBorderColor',
            'sidePanelMutedTextColor',
            'sidePanelTextColor',
        ];

        foreach (['', 'dark.', 'light.'] as $prefix) {
            foreach ($colorFields as $field) {
                $rules["background_config.{$prefix}{$field}"] = ['nullable', 'string', 'max:255'];
            }

            $rules["background_config.{$prefix}imageUrl"] = ['nullable', 'string', 'max:2048'];
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function fillNode(LearningNode $node, LearningMap $map, array $data): void
    {
        $title = (string) $data['title'];
        $slug = ($data['slug'] ?? null) ?: $this->uniqueNodeSlug($map, $title, $node->exists ? $node : null);
        $visualConfig = $this->filterEmptyConfig($data['visual_config'] ?? []);

        $node->forceFill([
            'slug' => $slug,
            'title' => $title,
            'description' => $data['description'] ?? null,
            'state' => $data['state'],
            'visual_config' => array_replace_recursive([
                'icon' => 'map',
                'label' => $title,
                'dark' => [
                    'tileColor' => '#253047',
                    'foregroundColor' => '#bfdbfe',
                    'labelColor' => '#ffffff',
                    'highlightColor' => '#7dd3fc',
                ],
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ], $visualConfig),
        ]);
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function filterEmptyConfig(array $config): array
    {
        $filtered = [];

        foreach ($config as $key => $value) {
            if (is_array($value)) {
                $nested = $this->filterEmptyConfig($value);

                if ($nested !== []) {
                    $filtered[$key] = $nested;
                }

                continue;
            }

            if ($value !== null && $value !== '') {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    /**
     * Merge editable config fields into existing JSON while allowing submitted
     * empty strings to clear earlier values.
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private function mergeSubmittedConfig(array $existing, array $incoming): array
    {
        foreach ($incoming as $key => $value) {
            if (is_array($value)) {
                $merged = $this->mergeSubmittedConfig(
                    is_array($existing[$key] ?? null) ? $existing[$key] : [],
                    $value,
                );

                if ($merged === []) {
                    unset($existing[$key]);
                } else {
                    $existing[$key] = $merged;
                }

                continue;
            }

            if ($value === null || $value === '') {
                unset($existing[$key]);
            } else {
                $existing[$key] = $value;
            }
        }

        return $existing;
    }

    /**
     * @return Builder<LearningWorld>
     */
    private function demoWorldQuery(): Builder
    {
        return LearningWorld::query()->where('slug', 'demo-cybersecurity');
    }

    /**
     * @return array<string, mixed>
     */
    private function worldSummary(LearningWorld $world): array
    {
        return [
            'id' => $world->id,
            'slug' => $world->slug,
            'title' => $world->title,
            'description' => $world->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapSummary(LearningMap $map): array
    {
        return [
            'id' => $map->id,
            'slug' => $map->slug,
            'title' => $map->title,
            'description' => $map->description,
            'nodeCount' => $map->nodes->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeSummary(LearningNode $node): array
    {
        return [
            'id' => $node->id,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'position' => [
                'q' => $node->position_q,
                'r' => $node->position_r,
            ],
            'state' => $node->state,
            'visualConfig' => $node->visual_config ?? [],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function portalLinksFor(LearningWorld $world): array
    {
        $mapIds = $world->maps->pluck('id');

        return LearningPortalLink::query()
            ->with(['sourceActivity', 'sourceNode.map', 'targetActivity', 'targetNode.map'])
            ->whereHas('sourceNode', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->orWhereHas('targetNode', fn ($query) => $query->whereIn('learning_map_id', $mapIds))
            ->get()
            ->map(fn (LearningPortalLink $link): array => [
                'id' => $link->id,
                'label' => $link->label,
                'description' => $link->description,
                'sourceMapId' => $link->sourceNode->map->id,
                'targetMapId' => $link->targetNode->map->id,
                'sourceActivity' => $link->sourceActivity ? [
                    'id' => $link->sourceActivity->id,
                    'title' => $link->sourceActivity->title,
                    'type' => $link->sourceActivity->type,
                ] : null,
                'targetActivity' => $link->targetActivity ? [
                    'id' => $link->targetActivity->id,
                    'title' => $link->targetActivity->title,
                    'type' => $link->targetActivity->type,
                ] : null,
                'sourceNode' => $this->nodeSummary($link->sourceNode),
                'targetNode' => $this->nodeSummary($link->targetNode),
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function portalCandidatesFor(LearningWorld $world): array
    {
        return $world->maps
            ->flatMap(fn (LearningMap $map) => $map->nodes->map(fn (LearningNode $node): array => [
                ...$this->nodeSummary($node),
                'mapId' => $map->id,
                'mapTitle' => $map->title,
            ]))
            ->values()
            ->all();
    }

    private function worldNodeOrFail(LearningWorld $world, int $nodeId): LearningNode
    {
        $mapIds = $world->maps->pluck('id');

        return LearningNode::query()
            ->whereIn('learning_map_id', $mapIds)
            ->findOrFail($nodeId);
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

    private function uniqueNodeSlug(LearningMap $map, string $title, ?LearningNode $existingNode = null): string
    {
        $baseSlug = Str::slug($title) ?: 'node';
        $slug = $baseSlug;
        $suffix = 2;

        while (LearningNode::query()
            ->where('learning_map_id', $map->id)
            ->where('slug', $slug)
            ->when($existingNode, fn (Builder $query) => $query->whereKeyNot($existingNode->id))
            ->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function uniqueMapSlug(LearningWorld $world, string $title): string
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

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: int, 1: int}
     */
    private function validatedDirection(array $data): array
    {
        $direction = [(int) $data['direction_q'], (int) $data['direction_r']];
        $allowedDirections = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

        if (! in_array($direction, $allowedDirections, true)) {
            throw ValidationException::withMessages([
                'direction' => 'Choose one neighboring hex direction.',
            ]);
        }

        return $direction;
    }

    private function nodeAt(LearningMap $map, int $q, int $r): ?LearningNode
    {
        return LearningNode::query()
            ->where('learning_map_id', $map->id)
            ->where('position_q', $q)
            ->where('position_r', $r)
            ->first();
    }

    /**
     * @param  array{0: int, 1: int}  $direction
     */
    private function pushNodeChain(LearningMap $map, int $startQ, int $startR, array $direction): void
    {
        $chain = [];
        $q = $startQ;
        $r = $startR;

        while ($node = $this->nodeAt($map, $q, $r)) {
            $chain[] = $node;
            $q += $direction[0];
            $r += $direction[1];
        }

        foreach (array_reverse($chain) as $node) {
            $node->forceFill([
                'position_q' => $node->position_q + $direction[0],
                'position_r' => $node->position_r + $direction[1],
            ])->save();
        }
    }
}
