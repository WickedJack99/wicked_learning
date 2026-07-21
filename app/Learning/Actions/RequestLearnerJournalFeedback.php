<?php

namespace App\Learning\Actions;

use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearnerJournalPage;
use App\Models\PlatformJournalSetting;
use App\Models\User;

/** Creates the single review request associated with a learner journal page. */
class RequestLearnerJournalFeedback
{
    public function handle(User $learner, LearnerJournalPage $page): LearnerJournalFeedbackRequest
    {
        abort_unless((int) $page->user_id === (int) $learner->id, 404);
        abort_unless(
            PlatformJournalSetting::current()->allow_expert_access_requests,
            422,
            'Journal review requests are currently disabled.',
        );

        $existingRequest = LearnerJournalFeedbackRequest::query()
            ->where('learner_journal_page_id', $page->id)
            ->first();

        abort_if(
            $existingRequest?->responded_at !== null,
            422,
            'This journal page has already been reviewed.',
        );

        $page->forceFill(['expert_access_requested' => true])->save();

        if ($existingRequest !== null) {
            return $existingRequest;
        }

        return LearnerJournalFeedbackRequest::query()->create([
            'learner_journal_page_id' => $page->id,
            'requester_id' => $learner->id,
            'requested_at' => now(),
        ]);
    }
}
