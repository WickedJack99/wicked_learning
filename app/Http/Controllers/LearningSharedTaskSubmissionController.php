<?php

namespace App\Http\Controllers;

use App\Learning\Actions\ReviseSharedTaskContribution;
use App\Learning\Actions\SubmitSharedTaskContribution;
use App\Learning\Serializers\SharedTaskStateSerializer;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningSharedTaskSubmissionController extends Controller
{
    public function __construct(
        private readonly SubmitSharedTaskContribution $submitContribution,
        private readonly ReviseSharedTaskContribution $reviseContribution,
        private readonly SharedTaskStateSerializer $stateSerializer,
    ) {}

    public function store(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:20000'],
            'play_run_id' => ['required', 'uuid'],
            'share_with_peers' => ['sometimes', 'boolean'],
            'project_step_index' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:5'],
        ]);

        $submission = $this->submitContribution->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            (string) $data['body'],
            (bool) ($data['share_with_peers'] ?? false),
            isset($data['project_step_index']) ? (int) $data['project_step_index'] : null,
        );

        return response()->json([
            'submission' => [
                'id' => $submission->id,
                'status' => $submission->status,
                'acceptedAt' => $submission->accepted_at?->toIso8601String(),
            ],
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }

    public function updateRevision(
        Request $request,
        LearningActivity $activity,
        LearningSharedTaskSubmission $submission,
    ): JsonResponse {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:20000'],
            'play_run_id' => ['required', 'uuid'],
        ]);

        $updatedSubmission = $this->reviseContribution->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            $submission,
            (string) $data['body'],
        );

        return response()->json([
            'submission' => [
                'id' => $updatedSubmission->id,
                'revisedAt' => $updatedSubmission->revised_at?->toIso8601String(),
            ],
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }
}
