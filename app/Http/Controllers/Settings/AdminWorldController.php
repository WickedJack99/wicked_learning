<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningMap;
use App\Learning\Actions\CreateLearningNode;
use App\Learning\Actions\InsertLearningNodeIntoHexGrid;
use App\Learning\Actions\SwapLearningNode;
use App\Learning\Actions\UpdateLearningMapVisuals;
use App\Learning\Actions\UpdateLearningNode;
use App\Learning\Queries\LoadEditableMap;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Serializers\AdminToolSerializer;
use App\Learning\Serializers\AdminWorldGraphSerializer;
use App\Learning\Serializers\EditableMapSerializer;
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
        private readonly UpdateLearningMapVisuals $updateLearningMapVisuals,
        private readonly CreateLearningNode $createLearningNode,
        private readonly UpdateLearningNode $updateLearningNode,
        private readonly InsertLearningNodeIntoHexGrid $insertLearningNode,
        private readonly SwapLearningNode $swapLearningNode,
        private readonly WorldPortalLinkService $worldPortalLinks,
        private readonly NodeImageUploadService $nodeImages,
    ) {}

    public function index(): Response
    {
        return Inertia::render('settings/worlds/index', [
            'worldGraph' => $this->worldGraphSerializer->serialize(
                $this->loadEditableWorldGraph->handle(),
            ),
        ]);
    }

    public function editMap(LearningMap $map): Response
    {
        return Inertia::render('settings/worlds/edit-map', [
            'editableMap' => $this->editableMapSerializer->serialize(
                $this->loadEditableMap->handle($map),
            ),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->toolSerializer->serialize($tool))
                ->values()
                ->all(),
        ]);
    }

    public function storeMap(Request $request): RedirectResponse
    {
        $world = $this->loadEditableWorldGraph->handle();
        $this->createLearningMap->handle(
            $world,
            $request->validate($this->rules->storeMap($world)),
        );

        return redirect()->route('settings.worlds.index');
    }

    public function storePortalLink(Request $request): RedirectResponse
    {
        $this->worldPortalLinks->create(
            $this->loadEditableWorldGraph->handle(),
            $request->validate($this->rules->portalLink()),
        );

        return redirect()->route('settings.worlds.index');
    }

    public function destroyPortalLink(LearningPortalLink $portalLink): RedirectResponse
    {
        $this->worldPortalLinks->deleteFromWorld(
            $this->loadEditableWorldGraph->handle(),
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
        $this->createLearningNode->handle(
            $map,
            $request->validate($this->rules->node($request, $map)),
        );

        return $this->redirectToMap($map);
    }

    public function updateMap(Request $request, LearningMap $map): RedirectResponse
    {
        $this->updateLearningMapVisuals->handle(
            $map,
            $request->validate($this->rules->mapVisual()),
        );

        return $this->redirectToMap($map);
    }

    public function insertNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->insertLearningNode->handle(
            $node,
            $request->validate($this->rules->nodeInsert($node->map)),
        );

        return $this->redirectToMap($node->map);
    }

    public function updateNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->updateLearningNode->handle(
            $node,
            $request->validate($this->rules->node($request, $node->map, $node)),
        );

        return $this->redirectToMap($node->map);
    }

    public function swapNode(Request $request, LearningNode $node): RedirectResponse
    {
        $node->loadMissing('map');
        $this->swapLearningNode->handle(
            $node,
            $request->validate($this->rules->direction()),
        );

        return $this->redirectToMap($node->map);
    }

    private function redirectToMap(LearningMap $map): RedirectResponse
    {
        return redirect()->route('settings.worlds.maps.edit', $map);
    }
}
