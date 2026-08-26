<?php

namespace App\Http\Controllers\Settings;

use App\Ai\Actions\ApplyAiContentPlan;
use App\Ai\Actions\GenerateAiContentPlan;
use App\Ai\Actions\UpdateAiContentPlan;
use App\Ai\Serializers\AiContentAuthoringRunSerializer;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\GenerateAiContentPlanRequest;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\AiAgentTemplate;
use App\Models\AiContentAuthoringRun;
use App\Models\LearningMap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminAiContentAuthoringController extends Controller
{
    public function __construct(
        private readonly LearningMapEditAccessService $mapEditAccess,
        private readonly AiContentAuthoringRunSerializer $serializer,
    ) {}

    public function generate(
        GenerateAiContentPlanRequest $request,
        LearningMap $map,
        GenerateAiContentPlan $generate,
    ): JsonResponse {
        $this->authorizeMapEdit($request, $map);
        $template = AiAgentTemplate::query()->findOrFail($request->integer('template_id'));
        abort_unless($template->enabled && $template->purpose === 'content_authoring', 422);
        try {
            $run = $generate->handle($map, $template, $request->user(), $request->validated());
        } catch (ValidationException $exception) {
            return $this->validationError($exception);
        }

        return response()->json([
            'data' => $this->serializer->serialize($run),
        ], 201);
    }

    public function apply(
        Request $request,
        AiContentAuthoringRun $run,
        ApplyAiContentPlan $apply,
    ): JsonResponse {
        $run->loadMissing('map');
        $this->authorizeMapEdit($request, $run->map);
        abort_unless((int) $run->created_by_user_id === (int) $request->user()->id, 403);
        try {
            $apply->handle($run, $request->user());
        } catch (ValidationException $exception) {
            return $this->validationError($exception);
        }
        $run->refresh()->load('mapAsset.node.activities');

        return response()->json([
            'data' => $this->serializer->serialize($run),
        ], 201);
    }

    public function update(
        Request $request,
        AiContentAuthoringRun $run,
        UpdateAiContentPlan $update,
    ): JsonResponse {
        $run->loadMissing('map');
        $this->authorizeMapEdit($request, $run->map);
        abort_unless((int) $run->created_by_user_id === (int) $request->user()->id, 403);

        try {
            $data = $request->validate([
                'plan' => ['required', 'array'],
            ]);
            $update->handle($run, $data['plan']);
        } catch (ValidationException $exception) {
            return $this->validationError(
                $exception,
                'The edited ContentPlan did not satisfy the authoring contract.',
            );
        }

        return response()->json([
            'data' => $this->serializer->serialize($run->refresh()),
        ]);
    }

    private function authorizeMapEdit(Request $request, LearningMap $map): void
    {
        abort_unless($request->user() && $this->mapEditAccess->canEditMap($request->user(), $map), 403);
    }

    private function validationError(
        ValidationException $exception,
        string $message = 'The generated ContentPlan did not satisfy the authoring contract.',
    ): JsonResponse {
        return response()->json([
            'message' => $message,
            'errors' => $exception->errors(),
        ], 422);
    }
}
