<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadAdminJournalFeedbackRequests;
use App\Learning\Queries\LoadAdminPanelMetrics;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Serializers\AdminJournalFeedbackRequestSerializer;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\OrganizationIconReport;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformOrganizationSetting;
use App\Models\User;
use App\Organizations\Queries\LoadPendingOrganizationIconReports;
use App\Organizations\Serializers\OrganizationIconReportSerializer;

class LoadLearningSupportSettings
{
    public function __construct(
        private readonly LoadAdminPanelMetrics $metrics,
        private readonly LoadCompetenceTopicDefinitions $competenceTopics,
        private readonly LoadLearnerSupportSignals $supportSignals,
        private readonly LoadAdminJournalFeedbackRequests $feedbackRequests,
        private readonly AdminJournalFeedbackRequestSerializer $feedbackSerializer,
        private readonly LoadPendingOrganizationIconReports $iconReports,
        private readonly OrganizationIconReportSerializer $iconReportSerializer,
        private readonly PlatformJournalSettingsSerializer $journalSettingsSerializer,
    ) {}

    /**
     * @return array{adminPanel: array<string, mixed>|null, journal: array<string, mixed>|null, supportSignals: array<string, mixed>|null}
     */
    public function handle(User $user): array
    {
        return [
            'adminPanel' => $this->adminPanel($user),
            'journal' => $this->journal($user),
            'supportSignals' => $this->supportSignals($user),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function adminPanel(User $user): ?array
    {
        $canReviewFeedback = $user->can(PermissionCatalog::ability(PermissionCatalog::JOURNAL_FEEDBACK, AccessLevel::READ));
        $canManageCompetenceTopics = $user->can(PermissionCatalog::ability(PermissionCatalog::COMPETENCE_TOPICS, AccessLevel::READ));
        $canModerateOrganizations = $user->can(PermissionCatalog::ability(PermissionCatalog::ORGANIZATION_MODERATION, AccessLevel::READ));

        if (! $canReviewFeedback && ! $canManageCompetenceTopics && ! $canModerateOrganizations) {
            return null;
        }

        return [
            'metrics' => $this->metrics->handle(),
            'competenceTopics' => $canManageCompetenceTopics
                ? $this->competenceTopics->handle()
                : [],
            'feedbackRequests' => $canReviewFeedback
                ? $this->feedbackRequests->handle()
                    ->map(fn (LearnerJournalFeedbackRequest $feedbackRequest): array => $this->feedbackSerializer->feedbackRequest($feedbackRequest))
                    ->values()
                    ->all()
                : [],
            'organizationIconReports' => $canModerateOrganizations
                ? $this->iconReports->handle()
                    ->map(fn (OrganizationIconReport $report): array => $this->iconReportSerializer->serialize($report))
                    ->values()
                    ->all()
                : [],
            'organizationSettings' => [
                'maxMembershipsPerUser' => PlatformOrganizationSetting::current()->max_memberships_per_user,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function journal(User $user): ?array
    {
        return $user->can(PermissionCatalog::ability(PermissionCatalog::JOURNAL_SETTINGS, AccessLevel::READ))
            ? $this->journalSettingsSerializer->serialize(PlatformJournalSetting::current())
            : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function supportSignals(User $user): ?array
    {
        return $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNER_SUPPORT_SIGNALS, AccessLevel::READ))
            ? $this->supportSignals->handle($user)
            : null;
    }
}
