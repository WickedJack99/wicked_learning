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
use App\Learning\Actions\InsertLearningNodeIntoHexGrid;
use App\Learning\Actions\ResetLearningNodeUnlocks;
use App\Learning\Actions\SetLearnerNodeManualUnlock;
use App\Learning\Actions\SwapLearningNode;
use App\Learning\Actions\UpdateLearningMapAccess;
use App\Learning\Actions\UpdateLearningMapAsset;
use App\Learning\Actions\UpdateLearningMapDetails;
use App\Learning\Actions\UpdateLearningMapEditingGroups;
use App\Learning\Actions\UpdateLearningMapVisuals;
use App\Learning\Actions\UpdateLearningNode;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Queries\LoadLearningMapAssetVersions;
use App\Learning\Queries\LoadLearningMapVersions;
use App\Learning\Serializers\LearningMapAssetSerializer;
use App\Learning\Serializers\LearningMapAssetVersionSerializer;
use App\Learning\Serializers\LearningMapExportSerializer;
use App\Learning\Serializers\LearningMapVersionSerializer;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Services\NodeImageUploadService;
use App\Learning\Services\WorldPortalLinkService;
use App\Learning\Validation\AdminWorldRules;
use App\Learning\Validation\LearningMapExportValidator;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningMapAssetVersion;
use App\Models\LearningMapVersion;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminWorldController extends Controller
{
    public function __construct(
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly LoadLearningMapVersions $mapVersions,
        private readonly LoadLearningMapAssetVersions $mapAssetVersions,
        private readonly LearningMapAssetSerializer $mapAssetSerializer,
        private readonly LearningMapAssetVersionSerializer $mapAssetVersionSerializer,
        private readonly LearningMapExportSerializer $mapExportSerializer,
        private readonly LearningMapVersionSerializer $mapVersionSerializer,
        private readonly AdminWorldRules $rules,
        private readonly LearningMapExportValidator $mapExportValidator,
        private readonly CreateLearningMap $createLearningMap,
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
        private readonly DeleteLearningNode $deleteLearningNode,
        private readonly InsertLearningNodeIntoHexGrid $insertLearningNode,
        private readonly SwapLearningNode $swapLearningNode,
        private readonly ResetLearningNodeUnlocks $resetLearningNodeUnlocks,
        private readonly SetLearnerNodeManualUnlock $setLearnerNodeManualUnlock,
        private readonly WorldPortalLinkService $worldPortalLinks,
        private readonly NodeImageUploadService $nodeImages,
        private readonly LearningMapEditAccessService $mapEditAccess,
        private readonly LoadLearnerSupportSignals $learnerSupportSignals,
    ) {}

    public function index(Request $request): RedirectResponse
    {
        $this->authorizeGlobalWorldRead($request);

        return redirect()->route('settings.index', [
            'panel' => 'admin-world-builder',
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

    public function validateMapExport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'manifest' => ['required', 'file', 'mimes:json,txt', 'max:10240'],
        ]);

        return response()->json(
            $this->mapExportValidator->validate($data['manifest']),
        );
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

        $this->updateLearningMapEditingGroups->handle(
            $map,
            $request->validate($this->rules->mapEditingGroups())['group_ids'] ?? [],
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

        $data = $request->validate($this->rules->node($request, $node->map, $node));
        $this->rules->validateNodeUnlock($data, $node);

        $this->updateLearningNode->handle(
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

        $this->swapLearningNode->handle(
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
