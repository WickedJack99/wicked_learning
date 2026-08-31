<?php

namespace App\Http\Controllers;

use App\Learning\Actions\MarkSharedTaskPeerReviewHelpful;
use App\Learning\Actions\SaveSharedTaskReviewFollowUp;
use App\Learning\Actions\SubmitSharedTaskPeerReview;
use App\Learning\Serializers\SharedTaskStateSerializer;
use App\Models\LearningActivity;
use App\Models\LearningSharedTaskReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningSharedTaskReviewController extends Controller
{
    public function __construct(
        private readonly MarkSharedTaskPeerReviewHelpful $markReviewHelpful,
        private readonly SaveSharedTaskReviewFollowUp $saveFollowUp,
        private readonly SubmitSharedTaskPeerReview $submitReview,
        private readonly SharedTaskStateSerializer $stateSerializer,
    ) {}

    public function store(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'play_run_id' => ['required', 'uuid'],
            'submission_id' => ['required', 'integer'],
            'response_type' => ['nullable', 'string', 'in:explanation,example,question,counterexample'],
            'project_step_index' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:5'],
        ]);

        $review = $this->submitReview->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            (int) $data['submission_id'],
            (string) $data['body'],
            $data['response_type'] ?? null,
            isset($data['project_step_index']) ? (int) $data['project_step_index'] : null,
        );

        return response()->json([
            'review' => [
                'id' => $review->id,
                'responseType' => $review->response_type,
                'projectStepIndex' => $review->project_step_index,
                'createdAt' => $review->created_at?->toIso8601String(),
            ],
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }

    public function updateHelpfulness(
        Request $request,
        LearningActivity $activity,
        LearningSharedTaskReview $review,
    ): JsonResponse {
        $data = $request->validate([
            'helpful' => ['required', 'boolean'],
            'play_run_id' => ['required', 'uuid'],
        ]);

        $updatedReview = $this->markReviewHelpful->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            $review,
            (bool) $data['helpful'],
        );

        return response()->json([
            'helpful' => $updatedReview->helpful_at !== null,
            'reviewId' => $updatedReview->id,
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }

    public function updateFollowUp(
        Request $request,
        LearningActivity $activity,
        LearningSharedTaskReview $review,
    ): JsonResponse {
        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:2000'],
            'play_run_id' => ['required', 'uuid'],
        ]);

        $followUp = $this->saveFollowUp->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            $review,
            $data['body'] ?? null,
        );

        return response()->json([
            'followUp' => $followUp ? [
                'body' => $followUp->body,
                'updatedAt' => $followUp->updated_at?->toIso8601String(),
            ] : null,
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }
}
