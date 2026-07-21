<?php

namespace App\Learning\Queries;

use App\Models\LearnerJournalFeedbackRequest;
use Illuminate\Database\Eloquent\Collection;

/** Loads requested and completed journal feedback for administration. */
class LoadAdminJournalFeedbackRequests
{
    /** @return Collection<int, LearnerJournalFeedbackRequest> */
    public function handle(): Collection
    {
        return LearnerJournalFeedbackRequest::query()
            ->with(['page', 'requester', 'reviewer'])
            ->latest('requested_at')
            ->get();
    }
}
