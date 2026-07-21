<?php

namespace App\Learning\Actions;

use App\Models\LearnerJournalFeedbackRequest;
use App\Models\User;

/** Attaches a one-time administrator response to a learner feedback request. */
class RespondToLearnerJournalFeedback
{
    public function handle(
        User $reviewer,
        LearnerJournalFeedbackRequest $feedbackRequest,
        string $feedback,
    ): LearnerJournalFeedbackRequest {
        abort_if($feedbackRequest->responded_at !== null, 422);

        $feedbackRequest->forceFill([
            'feedback' => $feedback,
            'reviewer_id' => $reviewer->id,
            'responded_at' => now(),
        ])->save();

        return $feedbackRequest;
    }
}
