<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningMap;
use App\Learning\Actions\CreateLearningNode;
use App\Learning\Actions\DeleteLearningMap;
use App\Learning\Actions\DeleteLearningNode;
use App\Learning\Actions\InsertLearningNodeIntoHexGrid;
use App\Learning\Actions\ResetLearningNodeUnlocks;
use App\Learning\Actions\SwapLearningNode;
use App\Learning\Actions\UpdateLearningMapAccess;
use App\Learning\Actions\UpdateLearningMapDetails;
use App\Learning\Actions\UpdateLearningMapEditingGroups;
use App\Learning\Actions\UpdateLearningMapVisuals;
use App\Learning\Actions\UpdateLearningNode;
use App\Learning\Queries\LoadEditableMap;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Queries\LoadLearningGroupOptions;
use App\Learning\Queries\LoadLearningMapAccessGroups;
use App\Learning\Serializers\AdminToolSerializer;
use App\Learning\Serializers\AdminWorldGraphSerializer;
use App\Learning\Serializers\EditableMapSerializer;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Services\NodeImageUploadService;
use App\Learning\Services\WorldPortalLinkService;
use App\Learning\Validation\AdminWorldRules;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningPortalLink;
use App\Models\LearningTool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminWorldController extends Controller
{
    public function __construct(
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly LoadEditableMap $loadEditableMap,
        private readonly LoadEditableTools $loadEditableTools,
        private readonly AdminWorldGraphSerializer $worldGraphSerializer,
        private readonly EditableMapSerializer $editableMapSerializer,
        private readonly AdminToolSerializer $toolSerializer,
        private readonly AdminWorldRules $rules,
        private readonly CreateLearningMap $createLearningMap,
        private readonly UpdateLearningMapAccess $updateLearningMapAccess,
        private readonly UpdateLearningMapEditingGroups $updateLearningMapEditingGroups,
        private readonly UpdateLearningMapDetails $updateLearningMapDetails,
        private readonly UpdateLearningMapVisuals $updateLearningMapVisuals,
        private readonly DeleteLearningMap $deleteLearningMap,
        private readonly CreateLearningNode $createLearningNode,
        private readonly UpdateLearningNode $updateLearningNode,
        private readonly DeleteLearningNode $deleteLearningNode,
        private readonly InsertLearningNodeIntoHexGrid $insertLearningNode,
        private readonly SwapLearningNode $swapLearningNode,
        private readonly ResetLearningNodeUnlocks $resetLearningNodeUnlocks,
        private readonly WorldPortalLinkService $worldPortalLinks,
        private readonly NodeImageUploadService $nodeImages,
        private readonly LoadLearningMapAccessGroups $loadMapAccessGroups,
        private readonly LoadLearningGroupOptions $loadLearningGroupOptions,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('settings/worlds/index', [
            'canDeleteWorldMaps' => $request->user()?->can(PermissionCatalog::ability(PermissionCatalog::WORLD_MAPS, 'rud')) ?? false,
            'worldGraph' => $this->worldGraphSerializer->serialize(
                $this->loadEditableWorldGraph->handle($request->user()),
            ),
        ]);
    }

    public function editMap(Request $request, LearningMap $map): Response
    {
        $this->authorizeMapEdit($request, $map);

        return Inertia::render('settings/worlds/edit-map', [
            'editableMap' => $this->editableMapSerializer->serialize(
                $this->loadEditableMap->handle($map),
            ),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                ->values()
                ->all(),
            'accessGroups' => $this->loadMapAccessGroups->handle(),
            'learningGroups' => $this->loadLearningGroupOptions->handle(),
        ]);
    }

    public function configureMap(Request $request, LearningMap $map): Response
    {
        $this->authorizeMapEdit($request, $map);

        return Inertia::render('settings/worlds/configure-map', [
            'canDeleteWorldMaps' => request()->user()
                ? $this->mapEditAccess->canDeleteMap(request()->user(), $map)
                : false,
            'editableMap' => $this->editableMapSerializer->serialize(
                $this->loadEditableMap->handle($map),
            ),
            'accessGroups' => $this->loadMapAccessGroups->handle(),
            'learningGroups' => $this->loadLearningGroupOptions->handle(),
        ]);
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

        return redirect()->route('settings.worlds.index');
    }

    public function storePortalLink(Request $request): RedirectResponse
    {
        $this->authorizeGlobalWorldEdit($request);

        $this->worldPortalLinks->create(
            $this->loadEditableWorldGraph->handle($request->user()),
            $request->validate($this->rules->portalLink()),
        );

        return redirect()->route('settings.worlds.index');
    }

    public function destroyPortalLink(LearningPortalLink $portalLink): RedirectResponse
    {
        $this->authorizeGlobalWorldEdit(request());

        $this->worldPortalLinks->deleteFromWorld(
            $this->loadEditableWorldGraph->handle(request()->user()),
            $portalLink,
        );

        return redirect()->route('settings.worlds.index');
    }

    public function uploadNodeImage(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->uploadNodeImage());

        return response()->json([
            'url' => $this->nodeImages->upload($data['image'] ?? null),
        ]);
    }

    public function storeNode(Request $request, LearningMap $map): RedirectResponse
    {
        $this->authorizeMapNodeEdit($request, $map);

        $this->createLearningNode->handle(
            $map,
            $request->validate($this->rules->node($request, $map)),
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

        $this->updateLearningMapDetails->handle(
            $map,
            $request->validate($this->rules->mapDetails()),
        );

        return $this->redirectBackToMap($map);
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

        return redirect()->route('settings.worlds.index');
    }

    public function insertNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);

        $this->insertLearningNode->handle(
            $node,
            $request->validate($this->rules->nodeInsert($node->map)),
        );

        return $this->redirectToMap($node->map);
    }

    public function updateNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->authorizeMapEdit($request, $node->map);

        $this->updateLearningNode->handle(
            $node,
            $request->validate($this->rules->node($request, $node->map, $node)),
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

    private function redirectToMap(LearningMap $map): RedirectResponse
    {
        return redirect()->route('settings.worlds.maps.edit', $map);
    }

    private function redirectBackToMap(LearningMap $map): RedirectResponse
    {
        return redirect()->back(
            fallback: route('settings.worlds.maps.edit', $map),
        );
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
}
