<?php

namespace App\Http\Controllers;

use App\Learning\Actions\SubmitSharedTaskContribution;
use App\Learning\Serializers\SharedTaskStateSerializer;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningSharedTaskSubmissionController extends Controller
{
    public function __construct(
        private readonly SubmitSharedTaskContribution $submitContribution,
        private readonly SharedTaskStateSerializer $stateSerializer,
    ) {}

    public function store(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:20000'],
            'play_run_id' => ['required', 'uuid'],
        ]);

        $submission = $this->submitContribution->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            (string) $data['body'],
        );

        return response()->json([
            'submission' => [
                'id' => $submission->id,
                'status' => $submission->status,
                'acceptedAt' => $submission->accepted_at?->toIso8601String(),
            ],
            'state' => $this->stateSerializer->state($activity),
        ]);
    }
}
