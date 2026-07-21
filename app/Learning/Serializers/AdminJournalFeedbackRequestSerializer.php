<?php

namespace App\Learning\Serializers;

use App\Models\LearnerJournalFeedbackRequest;

/** Shapes journal feedback requests for the administrative review panel. */
class AdminJournalFeedbackRequestSerializer
{
    public function feedbackRequest(LearnerJournalFeedbackRequest $feedbackRequest): array
    {
        return [
            'id' => $feedbackRequest->id,
            'feedback' => $feedbackRequest->feedback,
            'requestedAt' => $feedbackRequest->requested_at?->toIso8601String(),
            'respondedAt' => $feedbackRequest->responded_at?->toIso8601String(),
            'status' => $feedbackRequest->responded_at === null ? 'pending' : 'responded',
            'page' => [
                'id' => $feedbackRequest->page?->id,
                'markdown' => $feedbackRequest->page?->markdown,
                'subtopic' => $feedbackRequest->page?->subtopic ?: null,
                'title' => $feedbackRequest->page?->title,
                'topic' => $feedbackRequest->page?->topic,
            ],
            'requester' => [
                'id' => $feedbackRequest->requester?->id,
                'name' => $feedbackRequest->requester?->name,
                'email' => $feedbackRequest->requester?->email,
            ],
        ];
    }
}
