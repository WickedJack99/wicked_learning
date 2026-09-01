<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningMap;
use App\Learning\Actions\CreateLearningMapAsset;
use App\Learning\Actions\CreateLearningNode;
use App\Learning\Actions\DeleteLearningMap;
use App\Learning\Actions\DeleteLearningMapAsset;
use App\Learning\Actions\DeleteLearningNode;
use App\Learning\Actions\DuplicateLearningMap;
use App\Learning\Actions\ImportLearningMap;
use App\Learning\Actions\ImportLearningMapAsset;
use App\Learning\Actions\ImportLearningWorld;
use App\Learning\Actions\InsertLearningNodeIntoHexGrid;
use App\Learning\Actions\ResetLearningNodeUnlocks;
use App\Learning\Actions\RestoreLearningMapLayoutVersion;
use App\Learning\Actions\SetLearnerNodeManualUnlock;
use App\Learning\Actions\SwapLearningNode;
use App\Learning\Actions\UpdateLearningMapAccess;
use App\Learning\Actions\UpdateLearningMapAsset;
use App\Learning\Actions\UpdateLearningMapDetails;
use App\Learning\Actions\UpdateLearningMapEditingGroups;
use App\Learning\Actions\UpdateLearningMapVisuals;
use App\Learning\Actions\UpdateLearningNode;
use App\Learning\CurrentWorldResolver;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Queries\LoadLearningMapAssetVersions;
use App\Learning\Queries\LoadLearningMapLayoutVersions;
use App\Learning\Queries\LoadLearningMapVersions;
use App\Learning\Queries\LoadWorldBuilderReviewQueue;
use App\Learning\Serializers\LearningMapAssetSerializer;
use App\Learning\Serializers\LearningMapAssetVersionSerializer;
use App\Learning\Serializers\LearningMapExportSerializer;
use App\Learning\Serializers\LearningMapLayoutVersionSerializer;
use App\Learning\Serializers\LearningMapVersionSerializer;
use App\Learning\Serializers\LearningWorldExportSerializer;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Services\LearningMapTransferPackageService;
use App\Learning\Services\NodeImageUploadService;
use App\Learning\Services\WorldPortalLinkService;
use App\Learning\Validation\AdminWorldRules;
use App\Learning\Validation\LearningMapExportValidator;
use App\Learning\Validation\LearningWorldExportValidator;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMapAssetVersion;
use App\Models\LearningMapLayoutVersion;
use App\Models\LearningMapVersion;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use JsonException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminWorldController extends Controller
{
    public function __construct(
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly LoadLearningMapVersions $mapVersions,
        private readonly LoadLearningMapLayoutVersions $mapLayoutVersions,
        private readonly LoadLearningMapAssetVersions $mapAssetVersions,
        private readonly LearningMapAssetSerializer $mapAssetSerializer,
        private readonly LearningMapAssetVersionSerializer $mapAssetVersionSerializer,
        private readonly LearningMapExportSerializer $mapExportSerializer,
        private readonly LearningMapTransferPackageService $mapTransferPackage,
        private readonly LearningWorldExportSerializer $worldExportSerializer,
        private readonly LearningMapVersionSerializer $mapVersionSerializer,
        private readonly LearningMapLayoutVersionSerializer $mapLayoutVersionSerializer,
        private readonly AdminWorldRules $rules,
        private readonly LearningMapExportValidator $mapExportValidator,
        private readonly LearningWorldExportValidator $worldExportValidator,
        private readonly CreateLearningMap $createLearningMap,
        private readonly DuplicateLearningMap $duplicateLearningMap,
        private readonly ImportLearningMap $importLearningMap,
        private readonly ImportLearningMapAsset $importLearningMapAsset,
        private readonly ImportLearningWorld $importLearningWorld,
        private readonly CreateLearningMapAsset $createLearningMapAsset,
        private readonly UpdateLearningMapAccess $updateLearningMapAccess,
        private readonly UpdateLearningMapEditingGroups $updateLearningMapEditingGroups,
        private readonly UpdateLearningMapDetails $updateLearningMapDetails,
        private readonly UpdateLearningMapVisuals $updateLearningMapVisuals,
        private readonly DeleteLearningMap $deleteLearningMap,
        private readonly DeleteLearningMapAsset $deleteLearningMapAsset,
        private readonly UpdateLearningMapAsset $updateLearningMapAsset,
        private readonly CreateLearningNode $createLearningNode,
        private readonly UpdateLearningNode $updateLearningNode,
        private readonly RestoreLearningMapLayoutVersion $restoreMapLayoutVersion,
        private readonly DeleteLearningNode $deleteLearningNode,
        private readonly InsertLearningNodeIntoHexGrid $insertLearningNode,
        private readonly SwapLearningNode $swapLearningNode,
        private readonly ResetLearningNodeUnlocks $resetLearningNodeUnlocks,
        private readonly SetLearnerNodeManualUnlock $setLearnerNodeManualUnlock,
        private readonly WorldPortalLinkService $worldPortalLinks,
        private readonly NodeImageUploadService $nodeImages,
        private readonly LearningMapEditAccessService $mapEditAccess,
        private readonly LoadLearnerSupportSignals $learnerSupportSignals,
        private readonly LoadWorldBuilderReviewQueue $reviewQueue,
        private readonly CurrentWorldResolver $worldResolver,
    ) {}

    public function index(Request $request): RedirectResponse
    {
        $this->authorizeGlobalWorldRead($request);

        return redirect()->route('settings.index', [
            'panel' => 'admin-world-builder',
        ]);
    }

    public function reviewQueue(Request $request): JsonResponse
    {
        $this->authorizeGlobalWorldRead($request);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);
        $activities = $this->reviewQueue->paginate(
            $user,
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? LoadWorldBuilderReviewQueue::DEFAULT_PAGE_SIZE,
        );

        return response()->json([
            'items' => collect($activities->items())
                ->map(fn (LearningActivity $activity): array => [
                    'activity' => [
                        'id' => $activity->id,
                        'title' => $activity->title,
                        'type' => $activity->type,
                    ],
                    'map' => [
                        'id' => $activity->node->map->id,
                        'title' => $activity->node->map->title,
                    ],
                    'node' => [
                        'id' => $activity->node->id,
                        'title' => $activity->node->title,
                    ],
                ])
                ->values()
                ->all(),
            'pagination' => [
                'page' => $activities->currentPage(),
                'perPage' => $activities->perPage(),
                'total' => $activities->total(),
                'lastPage' => $activities->lastPage(),
            ],
        ]);
    }

    public function editMap(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);

        return redirect()->route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'nodes',
        ]);
    }

    public function configureMap(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);

        return redirect()->route('settings.index', [
            'panel' => 'admin-world-builder',
            'map' => $map->id,
            'worldView' => 'configure',
        ]);
    }

    public function exportMap(Request $request, LearningMap $map): StreamedResponse
    {
        $this->authorizeMapEdit($request, $map);
        $payload = $this->mapExportSerializer->serialize($map);

        return response()->streamDownload(
            static function () use ($payload): void {
                echo json_encode(
                    $payload,
                    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
                ).PHP_EOL;
            },
            "{$map->slug}-wicked-learning-map.json",
            ['Content-Type' => 'application/json'],
        );
    }

    public function exportMapPackage(Request $request, LearningMap $map): BinaryFileResponse
    {
        $this->authorizeMapEdit($request, $map);
        $package = $this->mapTransferPackage->export($map);

        return response()
            ->download($package['path'], "{$map->slug}-wicked-learning-map.zip", [
                'Content-Type' => 'application/zip',
            ])
            ->deleteFileAfterSend(true);
    }

    public function exportMapAsset(Request $request, LearningMapAsset $asset): StreamedResponse
    {
        $asset->loadMissing('map');
        $this->authorizeMapEdit($request, $asset->map);
        $payload = $this->mapExportSerializer->serializeAsset($asset);
        $asset->loadMissing('node');
        $filename = ($asset->node?->slug ?: "map-asset-{$asset->id}").'-wicked-learning-asset.json';

        return response()->streamDownload(
            static function () use ($payload): void {
                echo json_encode(
                    $payload,
                    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
                ).PHP_EOL;
            },
            $filename,
            ['Content-Type' => 'application/json'],
        );
    }

    public function exportMapAssetPackage(Request $request, LearningMapAsset $asset): BinaryFileResponse
    {
        $asset->loadMissing(['map', 'node']);
        $this->authorizeMapEdit($request, $asset->map);
        $package = $this->mapTransferPackage->exportAsset($asset);
        $filename = ($asset->node?->slug ?: "map-asset-{$asset->id}").'-wicked-learning-asset.zip';

        return response()
            ->download($package['path'], $filename, [
                'Content-Type' => 'application/zip',
            ])
            ->deleteFileAfterSend(true);
    }

    public function importMapAsset(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);
        $world = $map->world;
        abort_unless($world !== null, 422, 'The map must belong to a world.');

        $data = $request->validate($this->rules->importMapAsset());
        $prepared = $this->mapTransferPackage->isPackage($data['manifest'])
            ? $this->mapTransferPackage->prepare($data['manifest'])
            : null;
        $payload = $prepared['payload'] ?? null;

        try {
            $validation = $prepared === null
                ? $this->mapExportValidator->validateAsset($data['manifest'])
                : $this->mapExportValidator->validateAssetPayload($payload);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        if (! $validation['valid']) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => $validation['summary'].' '.implode(' ', $validation['errors']),
            ]);
        }

        if ($payload === null) {
            try {
                $payload = json_decode($data['manifest']->get(), true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw ValidationException::withMessages([
                    'manifest' => 'The selected file is not valid JSON.',
                ]);
            }
        }

        if (! is_array($payload) || data_get($payload, 'source.world.slug') !== $world->slug) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => 'Import an asset exported from the current workspace.',
            ]);
        }

        try {
            $this->importLearningMapAsset->handle($payload, $world, $map);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        return $this->redirectBackToMap($map);
    }

    public function exportWorld(Request $request): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $world = $this->worldResolver->query()->firstOrFail();
        $mapsQuery = $world->maps();
        $this->mapEditAccess->scopeMapsUserCanEdit($mapsQuery->getQuery(), $user);
        $maps = $mapsQuery->get();
        $payload = $this->worldExportSerializer->serialize($world, $maps);

        return response()->streamDownload(
            static function () use ($payload): void {
                echo json_encode(
                    $payload,
                    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
                ).PHP_EOL;
            },
            "{$world->slug}-wicked-learning-world.json",
            ['Content-Type' => 'application/json'],
        );
    }

    public function exportWorldPackage(Request $request): BinaryFileResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $world = $this->worldResolver->query()->firstOrFail();
        $mapsQuery = $world->maps();
        $this->mapEditAccess->scopeMapsUserCanEdit($mapsQuery->getQuery(), $user);
        $maps = $mapsQuery->get();
        $package = $this->mapTransferPackage->exportPayload(
            $this->worldExportSerializer->serialize($world, $maps),
        );

        return response()
            ->download($package['path'], "{$world->slug}-wicked-learning-world.zip", [
                'Content-Type' => 'application/zip',
            ])
            ->deleteFileAfterSend(true);
    }

    public function validateMapExport(Request $request): JsonResponse
    {
        $scope = $request->validate([
            'scope' => ['nullable', 'in:map,world'],
        ])['scope'] ?? 'map';
        $data = $request->validate([
            'manifest' => [
                'required',
                'file',
                'mimes:json,txt,zip',
                'max:51200',
            ],
        ]);

        if ($scope === 'world') {
            $world = $this->worldResolver->query()->firstOrFail();

            if ($this->mapTransferPackage->isPackage($data['manifest'])) {
                $prepared = $this->mapTransferPackage->prepare($data['manifest']);

                try {
                    $result = $this->worldExportValidator->validatePayload(
                        $prepared['payload'],
                        $world,
                    );
                    $sourceByDestination = array_flip($prepared['sourceToDestination']);
                    $result['mediaReferenceDetails'] = array_map(
                        static fn (array $detail): array => [
                            ...$detail,
                            'url' => $sourceByDestination[$detail['url']] ?? $detail['url'],
                        ],
                        $result['mediaReferenceDetails'],
                    );

                    return response()->json($result);
                } finally {
                    $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
                }
            }

            return response()->json(
                $this->worldExportValidator->validate($data['manifest'], $world),
            );
        }

        if ($this->mapTransferPackage->isPackage($data['manifest'])) {
            $prepared = $this->mapTransferPackage->prepare($data['manifest']);

            try {
                $result = $this->mapExportValidator->validatePayload($prepared['payload']);
                $sourceByDestination = array_flip($prepared['sourceToDestination']);
                $result['mediaReferenceDetails'] = array_map(
                    static fn (array $detail): array => [
                        ...$detail,
                        'url' => $sourceByDestination[$detail['url']] ?? $detail['url'],
                    ],
                    $result['mediaReferenceDetails'],
                );

                return response()->json($result);
            } finally {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }
        }

        return response()->json($this->mapExportValidator->validate($data['manifest']));
    }

    public function importMap(Request $request): RedirectResponse
    {
        $this->authorizeMapCreate($request);
        $world = $this->loadEditableWorldGraph->handle($request->user());
        $data = $request->validate($this->rules->importMap($world));
        $prepared = $this->mapTransferPackage->isPackage($data['manifest'])
            ? $this->mapTransferPackage->prepare($data['manifest'])
            : null;
        $payload = $prepared['payload'] ?? null;
        try {
            $validation = $prepared === null
                ? $this->mapExportValidator->validate($data['manifest'])
                : $this->mapExportValidator->validatePayload($payload);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        if (! $validation['valid']) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => $validation['summary'].' '.implode(' ', $validation['errors']),
            ]);
        }

        if ($payload === null) {
            try {
                $payload = json_decode($data['manifest']->get(), true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw ValidationException::withMessages([
                    'manifest' => 'The selected file is not valid JSON.',
                ]);
            }
        }

        if (($payload['world']['slug'] ?? null) !== $world->slug) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => 'Import a manifest exported from the current workspace.',
            ]);
        }

        $creator = $request->user();
        abort_unless($creator instanceof User, 401);

        try {
            $map = $this->importLearningMap->handle($payload, $world, $data, $creator);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        return $this->redirectToMap($map);
    }

    public function importWorld(Request $request): RedirectResponse
    {
        $this->authorizeMapCreate($request);
        $world = $this->worldResolver->query()->firstOrFail();
        $data = $request->validate([
            'manifest' => ['required', 'file', 'mimes:json,txt,zip', 'max:51200'],
        ]);
        $prepared = $this->mapTransferPackage->isPackage($data['manifest'])
            ? $this->mapTransferPackage->prepare($data['manifest'])
            : null;
        $payload = $prepared['payload'] ?? null;

        try {
            $validation = $prepared === null
                ? $this->worldExportValidator->validate($data['manifest'], $world)
                : $this->worldExportValidator->validatePayload($payload, $world);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        if (! $validation['valid']) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => $validation['summary'].' '.implode(' ', $validation['errors']),
            ]);
        }

        if ($payload === null) {
            try {
                $payload = json_decode($data['manifest']->get(), true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw ValidationException::withMessages([
                    'manifest' => 'The selected file is not valid JSON.',
                ]);
            }
        }

        if (! is_array($payload)) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw ValidationException::withMessages([
                'manifest' => 'The selected file is not a world bundle.',
            ]);
        }

        $creator = $request->user();
        abort_unless($creator instanceof User, 401);

        try {
            $this->importLearningWorld->handle($payload, $world, $creator);
        } catch (\Throwable $exception) {
            if ($prepared !== null) {
                $this->mapTransferPackage->deletePaths($prepared['createdPaths']);
            }

            throw $exception;
        }

        return $this->redirectToWorldGraph($request);
    }

    public function storeMap(Request $request): RedirectResponse
    {
        $this->authorizeMapCreate($request);

        $world = $this->loadEditableWorldGraph->handle($request->user());
        $this->createLearningMap->handle(
            $world,
            $request->validate($this->rules->storeMap($world)),
            $request->user(),
        );

        return $this->redirectToWorldGraph($request);
    }

    public function duplicateMap(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);
        $creator = $request->user();
        abort_unless($creator instanceof User, 401);

        $duplicate = $this->duplicateLearningMap->handle(
            $map,
            $request->validate($this->rules->duplicateMap($map)),
            $creator,
        );

        return $this->redirectToMap($duplicate);
    }

    public function storeMapAsset(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);

        $this->createLearningMapAsset->handle(
            $map,
            $request->validate($this->rules->mapAsset($map)),
        );

        return $this->redirectToMap($map);
    }

    public function updateMapAsset(Request $request, LearningMapAsset $asset): RedirectResponse
    {
        $asset->loadMissing('map');
        $this->authorizeMapEdit($request, $asset->map);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $this->updateLearningMapAsset->handle(
            $asset,
            $request->validate($this->rules->mapAsset($asset->map, $asset->id)),
            $user,
        );

        return $this->redirectToMap($asset->map);
    }

    public function destroyMapAsset(Request $request, LearningMapAsset $asset): RedirectResponse
    {
        $asset->loadMissing('map');
        $map = $asset->map;
        $this->authorizeMapEdit($request, $map);
        $this->deleteLearningMapAsset->handle($asset);

        return $this->redirectToMap($map);
    }

    public function mapAssetVersions(Request $request, LearningMapAsset $asset): JsonResponse
    {
        $asset->loadMissing('map');
        $this->authorizeMapEdit($request, $asset->map);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $versions = $this->mapAssetVersions->paginate(
            $asset,
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? 4,
        );

        return response()->json([
            'items' => $versions->getCollection()
                ->map(fn (LearningMapAssetVersion $version): array => $this->mapAssetVersionSerializer->serialize($version))
                ->values()
                ->all(),
            'pagination' => [
                'page' => $versions->currentPage(),
                'perPage' => $versions->perPage(),
                'total' => $versions->total(),
                'lastPage' => $versions->lastPage(),
            ],
        ]);
    }

    public function restoreMapAssetVersion(
        Request $request,
        LearningMapAsset $asset,
        LearningMapAssetVersion $version,
    ): JsonResponse {
        $asset->loadMissing('map');
        $this->authorizeMapEdit($request, $asset->map);
        abort_unless($version->learning_map_asset_id === $asset->id, 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $asset = $this->updateLearningMapAsset->handle($asset, [
            'focusable' => $version->focusable,
            'image_url' => $version->image_url,
            'interaction_config' => $version->interaction_config,
            'interaction_mode' => $version->interaction_mode,
            'locked' => $version->locked,
            'opacity' => $version->opacity,
            'position_x' => $version->position_x,
            'position_y' => $version->position_y,
            'position_z' => $version->position_z,
            'sound_config' => $version->sound_config,
            'text' => $version->text,
            'visual_config' => $version->visual_config,
            'width' => $version->width,
        ], $user);

        return response()->json([
            'asset' => $this->mapAssetSerializer->serialize($asset),
        ]);
    }

    public function storePortalLink(Request $request): RedirectResponse
    {
        $this->authorizeGlobalWorldEdit($request);

        $this->worldPortalLinks->create(
            $this->loadEditableWorldGraph->handle($request->user()),
            $request->validate($this->rules->portalLink()),
        );

        return $this->redirectToWorldGraph($request);
    }

    public function destroyPortalLink(LearningPortalLink $portalLink): RedirectResponse
    {
        $this->authorizeGlobalWorldEdit(request());

        $this->worldPortalLinks->deleteFromWorld(
            $this->loadEditableWorldGraph->handle(request()->user()),
            $portalLink,
        );

        return $this->redirectToWorldGraph(request());
    }

    public function uploadNodeImage(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->uploadNodeImage());
        $map = isset($data['map_id']) ? LearningMap::find((int) $data['map_id']) : null;

        if ($map) {
            $this->authorizeMapEdit($request, $map);
        }

        return response()->json([
            'url' => $this->nodeImages->upload($data['image'] ?? null, $map),
        ]);
    }

    public function storeNode(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapNodeEdit($request, $map);

        $data = $request->validate($this->rules->node($request, $map));
        $this->rules->validateNodeUnlock($data);

        $this->createLearningNode->handle(
            $map,
            $data,
        );

        return $this->redirectToMap($map);
    }

    public function updateMap(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);

        $this->updateLearningMapVisuals->handle(
            $map,
            $request->validate($this->rules->mapVisual()),
        );

        return $this->redirectBackToMap($map);
    }

    public function updateMapDetails(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapEdit($request, $map);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $this->updateLearningMapDetails->handle(
            $user,
            $map,
            $request->validate($this->rules->mapDetails()),
        );

        return $this->redirectBackToMap($map);
    }

    public function mapVersions(Request $request, LearningMap $map): JsonResponse
    {
        $this->authorizeMapEdit($request, $map);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $versions = $this->mapVersions->paginate(
            $map,
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? 6,
        );

        return response()->json([
            'items' => $versions->getCollection()
                ->map(fn (LearningMapVersion $version): array => $this->mapVersionSerializer->serialize($version))
                ->values()
                ->all(),
            'pagination' => [
                'page' => $versions->currentPage(),
                'perPage' => $versions->perPage(),
                'total' => $versions->total(),
                'lastPage' => $versions->lastPage(),
            ],
        ]);
    }

    public function restoreMapVersion(
        Request $request,
        LearningMap $map,
        LearningMapVersion $version,
    ): JsonResponse {
        $this->authorizeMapEdit($request, $map);
        abort_unless($version->learning_map_id === $map->id, 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $map = $this->updateLearningMapDetails->handle($user, $map, [
            'description' => $version->description,
            'map_assets_locked' => $version->map_assets_locked,
            'title' => $version->title,
            'topic_id' => $version->learning_topic_id,
        ]);

        return response()->json([
            'map' => [
                'description' => $map->description,
                'mapAssetsLocked' => (bool) $map->map_assets_locked,
                'topicId' => $map->learning_topic_id,
                'title' => $map->title,
            ],
        ]);
    }

    public function mapLayoutVersions(Request $request, LearningMap $map): JsonResponse
    {
        $this->authorizeMapEdit($request, $map);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $versions = $this->mapLayoutVersions->paginate(
            $map,
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? 6,
        );
        $currentNodeIds = $map->nodes()
            ->pluck('id')
            ->map(fn (mixed $nodeId): int => (int) $nodeId)
            ->sort()
            ->values()
            ->all();

        return response()->json([
            'items' => $versions->getCollection()
                ->map(fn (LearningMapLayoutVersion $version): array => $this->mapLayoutVersionSerializer->serialize($version, $currentNodeIds))
                ->values()
                ->all(),
            'pagination' => [
                'page' => $versions->currentPage(),
                'perPage' => $versions->perPage(),
                'total' => $versions->total(),
                'lastPage' => $versions->lastPage(),
            ],
        ]);
    }

    public function previewMapLayoutVersion(
        Request $request,
        LearningMap $map,
        LearningMapLayoutVersion $version,
    ): JsonResponse {
        $this->authorizeMapEdit($request, $map);
        abort_unless($version->learning_map_id === $map->id, 404);
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $snapshot = collect(is_array($version->snapshot) ? $version->snapshot : [])
            ->filter(fn (mixed $node): bool => is_array($node)
                && isset($node['nodeId'], $node['positionQ'], $node['positionR']))
            ->values();
        $page = max(1, $data['page'] ?? 1);
        $perPage = max(1, min(24, $data['per_page'] ?? 12));
        $items = $snapshot->forPage($page, $perPage)->values();
        $nodeIds = $items
            ->pluck('nodeId')
            ->map(fn (mixed $nodeId): int => (int) $nodeId)
            ->all();
        $currentNodes = $map->nodes()
            ->whereIn('id', $nodeIds)
            ->get(['id', 'position_q', 'position_r', 'title'])
            ->keyBy('id');

        return response()->json([
            'createdAt' => $version->created_at?->toIso8601String(),
            'items' => $items
                ->map(fn (array $node): array => [
                    'nodeId' => (int) $node['nodeId'],
                    'positionQ' => (int) $node['positionQ'],
                    'positionR' => (int) $node['positionR'],
                    'title' => $currentNodes->get((int) $node['nodeId'])?->title ?? 'Removed node',
                    'currentPositionQ' => $currentNodes->get((int) $node['nodeId'])?->position_q,
                    'currentPositionR' => $currentNodes->get((int) $node['nodeId'])?->position_r,
                ])
                ->all(),
            'pagination' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $snapshot->count(),
                'lastPage' => max(1, (int) ceil($snapshot->count() / $perPage)),
            ],
            'versionId' => $version->id,
        ]);
    }

    public function restoreMapLayoutVersion(
        Request $request,
        LearningMap $map,
        LearningMapLayoutVersion $version,
    ): JsonResponse {
        $this->authorizeMapEdit($request, $map);
        abort_unless($version->learning_map_id === $map->id, 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $map = $this->restoreMapLayoutVersion->handle($user, $map, $version);

        return response()->json([
            'map' => [
                'id' => $map->id,
                'title' => $map->title,
            ],
        ]);
    }

    public function updateMapAccess(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapAccessEdit($request, $map);

        $this->updateLearningMapAccess->handle(
            $map,
            $request->validate($this->rules->mapAccess()),
        );

        return $this->redirectBackToMap($map);
    }

    public function updateMapEditingGroups(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapAccessEdit($request, $map);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $this->updateLearningMapEditingGroups->handle(
            $map,
            $request->validate($this->rules->mapEditingGroups())['group_ids'] ?? [],
            $user,
        );

        return $this->redirectBackToMap($map);
    }

    public function destroyMap(LearningMap $map): RedirectResponse
    {
        $this->authorizeMapDelete(request(), $map);

        $this->deleteLearningMap->handle($map);

        return $this->redirectToWorldGraph(request());
    }

    public function insertNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);

        $data = $request->validate($this->rules->nodeInsert($node->map));
        $this->rules->validateNodeUnlock($data);

        $this->insertLearningNode->handle(
            $node,
            $data,
        );

        return $this->redirectToMap($node->map);
    }

    public function updateNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $data = $request->validate($this->rules->node($request, $node->map, $node));
        $this->rules->validateNodeUnlock($data, $node);

        $this->updateLearningNode->handle(
            $user,
            $node,
            $data,
        );

        return $this->redirectToMap($node->map);
    }

    public function destroyNode(LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $map = $node->map;
        $this->authorizeNodeDelete(request(), $node);

        $this->deleteLearningNode->handle($node);

        return $this->redirectToMap($map);
    }

    public function swapNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $this->swapLearningNode->handle(
            $user,
            $node,
            $request->validate($this->rules->direction()),
        );

        return $this->redirectToMap($node->map);
    }

    public function resetNodeUnlocks(LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit(request(), $node->map);

        $this->resetLearningNodeUnlocks->handle($node);

        return $this->redirectToMap($node->map);
    }

    public function setLearnerNodeManualUnlock(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);
        abort_unless(
            $request->user()?->can(PermissionCatalog::ability(PermissionCatalog::LEARNER_SUPPORT_SIGNALS, AccessLevel::READ)),
            403,
        );

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);
        $actor = $request->user();
        abort_unless(
            $actor instanceof User
                && $this->learnerSupportSignals->canViewLearner($actor, (int) $data['user_id']),
            403,
        );

        $learner = User::query()->findOrFail((int) $data['user_id']);
        $this->setLearnerNodeManualUnlock->handle(
            $learner,
            $node,
            $actor,
            (bool) $data['enabled'],
        );

        return back();
    }

    private function redirectToMap(LearningMap $map): RedirectResponse
    {
        if ($this->shouldReturnToSettingsWorkspace(request())) {
            return redirect()->route('settings.index', [
                'panel' => 'admin-world-builder',
                'map' => $map->id,
            ]);
        }

        return redirect()->route('settings.worlds.maps.edit', $map);
    }

    private function redirectBackToMap(LearningMap $map): RedirectResponse
    {
        return redirect()->back(
            fallback: $this->shouldReturnToSettingsWorkspace(request())
                ? route('settings.index', [
                    'panel' => 'admin-world-builder',
                    'map' => $map->id,
                ])
                : route('settings.worlds.maps.edit', $map),
        );
    }

    private function redirectToWorldGraph(Request $request): RedirectResponse
    {
        if ($this->shouldReturnToSettingsWorkspace($request)) {
            return redirect()->route('settings.index', ['panel' => 'admin-world-builder']);
        }

        return redirect()->route('settings.worlds.index');
    }

    private function shouldReturnToSettingsWorkspace(Request $request): bool
    {
        $referer = $request->headers->get('referer');

        return is_string($referer)
            && str_contains($referer, '/settings')
            && str_contains($referer, 'panel=admin-world-builder');
    }

    private function authorizeMapEdit(Request $request, LearningMap $map): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canEditMap($request->user(), $map), 403);
    }

    private function authorizeMapAccessEdit(Request $request, LearningMap $map): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canManageMapAccess($request->user(), $map), 403);
    }

    private function authorizeMapNodeEdit(Request $request, LearningMap $map): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canEditNodesOnMap($request->user(), $map), 403);
    }

    private function authorizeMapCreate(Request $request): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canCreateMap($request->user()), 403);
    }

    private function authorizeMapDelete(Request $request, LearningMap $map): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canDeleteMap($request->user(), $map), 403);
    }

    private function authorizeNodeDelete(Request $request, LearningNode $node): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canDeleteNode($request->user(), $node), 403);
    }

    private function authorizeGlobalWorldEdit(Request $request): void
    {
        abort_unless($request->user()?->hasAccess(PermissionCatalog::WORLD_MAP_ACCESS, AccessLevel::UPDATE) ?? false, 403);
    }

    private function authorizeGlobalWorldRead(Request $request): void
    {
        $canReadWorldBuilder = collect([
            PermissionCatalog::WORLD_MAPS,
            PermissionCatalog::WORLD_NODES,
            PermissionCatalog::WORLD_ACTIVITIES,
            PermissionCatalog::WORLD_MAP_ACCESS,
        ])->some(fn (string $resource): bool => $request->user()?->hasAccess($resource, AccessLevel::READ) ?? false);

        abort_unless($canReadWorldBuilder, 403);
    }
}
