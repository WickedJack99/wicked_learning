<?php

namespace App\Learning\Queries;

use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearnerJournalPage;
use App\Models\OrganizationIconReport;
use App\Models\User;

/** Collects the small set of metrics shown in the initial administration panel. */
class LoadAdminPanelMetrics
{
    /** @return array{registeredUsers: int, journalPages: int, feedbackRequests: int, pendingFeedbackRequests: int, pendingOrganizationIconReports: int} */
    public function handle(): array
    {
        return [
            'registeredUsers' => User::query()->count(),
            'journalPages' => LearnerJournalPage::query()->count(),
            'feedbackRequests' => LearnerJournalFeedbackRequest::query()->count(),
            'pendingFeedbackRequests' => LearnerJournalFeedbackRequest::query()
                ->whereNull('responded_at')
                ->count(),
            'pendingOrganizationIconReports' => OrganizationIconReport::query()
                ->where('status', OrganizationIconReport::STATUS_PENDING)
                ->count(),
        ];
    }
}
