<?php

namespace App\Http\Controllers\Api;

use App\ContentApi\ContentApiContract;
use App\ContentApi\ContentApiSerializer;
use App\Http\Controllers\Controller;
use App\Learning\Actions\CreateLearningActivity;
use App\Learning\Actions\CreateLearningMap;
use App\Learning\Actions\CreateLearningMapAsset;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Services\LearningMapEditAccessService;
use App\Learning\Validation\AdminActivityRules;
use App\Learning\Validation\AdminWorldRules;
use App\Models\LearningMap;
use App\Models\LearningMapAsset;
use App\Models\LearningNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentApiController extends Controller
{
    public function __construct(
        private readonly ContentApiContract $contract,
        private readonly ContentApiSerializer $serializer,
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly LearningMapEditAccessService $mapEditAccess,
        private readonly AdminWorldRules $worldRules,
        private readonly AdminActivityRules $activityRules,
        private readonly CreateLearningMap $createLearningMap,
        private readonly CreateLearningMapAsset $createLearningMapAsset,
        private readonly CreateLearningActivity $createLearningActivity,
    ) {}

    public function contract(): JsonResponse
    {
        return response()->json(['data' => $this->contract->document()]);
    }

    public function maps(Request $request): JsonResponse
    {
        $world = $this->loadEditableWorldGraph->handle($request->user());

        return response()->json([
            'data' => $world->maps
                ->map(fn (LearningMap $map): array => $this->serializer->map($map))
                ->values(),
        ]);
    }

    public function storeMap(Request $request): JsonResponse
    {
        abort_unless($this->mapEditAccess->canCreateMap($request->user()), 403);
        $world = $this->loadEditableWorldGraph->handle($request->user());
        $map = $this->createLearningMap->handle(
            $world,
            $request->validate($this->worldRules->storeMap($world)),
            $request->user(),
        );

        return response()->json(['data' => $this->serializer->map($map)], 201);
    }

    public function mapAssets(Request $request, LearningMap $map): JsonResponse
    {
        $this->authorizeMapEdit($request, $map);

        return response()->json([
            'data' => $map->assets()
                ->with('node')
                ->get()
                ->map(fn (LearningMapAsset $asset): array => $this->serializer->mapAsset($asset))
                ->values(),
        ]);
    }

    public function storeMapAsset(Request $request, LearningMap $map): JsonResponse
    {
        $this->authorizeMapEdit($request, $map);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            ...$this->worldRules->mapAsset($map),
        ]);
        $asset = $this->createLearningMapAsset->handle($map, $data);

        return response()->json([
            'data' => $this->serializer->mapAsset($asset),
        ], 201);
    }

    public function activities(Request $request, LearningMapAsset $mapAsset): JsonResponse
    {
        $node = $this->authorizeActivityEdit($request, $mapAsset);

        return response()->json([
            'data' => $node->activities()
                ->get()
                ->map(fn ($activity): array => $this->serializer->activity($activity))
                ->values(),
        ]);
    }

    public function storeActivity(Request $request, LearningMapAsset $mapAsset): JsonResponse
    {
        $node = $this->authorizeActivityEdit($request, $mapAsset);
        $activity = $this->createLearningActivity->handle(
            $node,
            $request->validate($this->activityRules->store($node)),
        );

        return response()->json([
            'data' => $this->serializer->activity($activity),
        ], 201);
    }

    private function authorizeMapEdit(Request $request, LearningMap $map): void
    {
        abort_unless($this->mapEditAccess->canEditMap($request->user(), $map), 403);
    }

    private function authorizeActivityEdit(Request $request, LearningMapAsset $asset): LearningNode
    {
        $asset->loadMissing('node.map');
        $node = $asset->node;
        abort_if($node === null, 404);
        abort_unless($this->mapEditAccess->canEditActivitiesOnNode($request->user(), $node), 403);

        return $node;
    }
}
