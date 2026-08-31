<?php

namespace App\Http\Controllers;

use App\Learning\Actions\SubmitSharedTaskPeerReview;
use App\Learning\Serializers\SharedTaskStateSerializer;
use App\Models\LearningActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningSharedTaskReviewController extends Controller
{
    public function __construct(
        private readonly SubmitSharedTaskPeerReview $submitReview,
        private readonly SharedTaskStateSerializer $stateSerializer,
    ) {}

    public function store(Request $request, LearningActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'play_run_id' => ['required', 'uuid'],
            'submission_id' => ['required', 'integer'],
        ]);

        $review = $this->submitReview->handle(
            $request->user(),
            $activity,
            (string) $data['play_run_id'],
            (int) $data['submission_id'],
            (string) $data['body'],
        );

        return response()->json([
            'review' => [
                'id' => $review->id,
                'createdAt' => $review->created_at?->toIso8601String(),
            ],
            'state' => $this->stateSerializer->state($activity, $request->user(), true),
        ]);
    }
}
