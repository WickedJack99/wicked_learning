<?php

namespace App\Learning\Serializers;

use App\Models\LearnerJournalFeedbackRequest;
use DateTimeInterface;

/** Shapes journal feedback requests for the administrative review panel. */
class AdminJournalFeedbackRequestSerializer
{
    /** @return array<string, mixed> */
    public function feedbackRequest(LearnerJournalFeedbackRequest $feedbackRequest): array
    {
        return [
            'id' => $feedbackRequest->id,
            'domain' => [
                'type' => $feedbackRequest->domain_type,
                'id' => $feedbackRequest->domain_id,
                'label' => $feedbackRequest->domain_label,
            ],
            'feedback' => $feedbackRequest->feedback,
            'requestedAt' => $this->date($feedbackRequest->requested_at),
            'respondedAt' => $this->date($feedbackRequest->responded_at),
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

    private function date(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
