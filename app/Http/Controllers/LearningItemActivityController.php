<?php

namespace App\Http\Controllers;

use App\Learning\Serializers\LearningItemSerializer;
use App\Learning\Services\ItemObstacleService;
use App\Learning\Services\LearningItemGrantService;
use App\Learning\Services\LearningPlayRunService;
use App\Models\LearningActivity;
use App\Models\LearningItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningItemActivityController extends Controller
{
    public function __construct(
        private readonly LearningItemGrantService $itemGrantService,
        private readonly ItemObstacleService $itemObstacleService,
        private readonly LearningItemSerializer $itemSerializer,
        private readonly LearningPlayRunService $playRunService,
    ) {}

    public function grantItems(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'play_run_id' => ['nullable', 'string', 'uuid'],
        ]);
        $playRunId = is_string($data['play_run_id'] ?? null) ? $data['play_run_id'] : null;

        abort_unless(
            ! $playRunId || $this->playRunService->canUseRun($request, $playRunId, $activity),
            403,
        );

        $result = $this->itemGrantService->rollAndGrant($request->user(), $activity, $playRunId);

        return response()->json([
            'inventory' => $this->inventory($request),
            'result' => $result,
        ]);
    }

    public function placeObstacleSlot(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'item_id' => ['required', 'integer'],
            'slot_index' => ['required', 'integer', 'min:0', 'max:9'],
        ]);

        $state = $this->itemObstacleService->placeItem(
            $request->user(),
            $activity,
            (int) $data['slot_index'],
            (int) $data['item_id'],
        );

        return response()->json([
            'inventory' => $this->inventory($request),
            'state' => $state,
        ]);
    }

    public function continueObstacle(Request $request, LearningActivity $activity): JsonResponse
    {
        return response()->json([
            'state' => $this->itemObstacleService->continue($request->user(), $activity),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function inventory(Request $request): array
    {
        return $request->user()
            ->learningItems()
            ->get()
            ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
            ->values()
            ->all();
    }
}
