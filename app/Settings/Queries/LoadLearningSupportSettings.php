<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadAdminJournalFeedbackRequests;
use App\Learning\Queries\LoadAdminPanelMetrics;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadLearnerManualUnlockTargets;
use App\Learning\Queries\LoadLearnerMessageModeration;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Queries\LoadLearningConcepts;
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
        private readonly LoadLearningConcepts $learningConcepts,
        private readonly LoadLearnerSupportSignals $supportSignals,
        private readonly LoadLearnerManualUnlockTargets $manualUnlockTargets,
        private readonly LoadLearnerMessageModeration $learnerMessages,
        private readonly LoadAdminJournalFeedbackRequests $feedbackRequests,
        private readonly AdminJournalFeedbackRequestSerializer $feedbackSerializer,
        private readonly LoadPendingOrganizationIconReports $iconReports,
        private readonly OrganizationIconReportSerializer $iconReportSerializer,
        private readonly PlatformJournalSettingsSerializer $journalSettingsSerializer,
    ) {}

    /**
     * @return array{adminPanel: array<string, mixed>|null, journal: array<string, mixed>|null, learnerMessages: array<int, array<string, mixed>>|null, supportSignals: array<string, mixed>|null}
     */
    public function handle(User $user): array
    {
        return [
            'adminPanel' => $this->adminPanel($user),
            'journal' => $this->journal($user),
            'learnerMessages' => $this->learnerMessages($user),
            'supportSignals' => $this->supportSignals($user),
        ];
    }

    /** @return array<int, array<string, mixed>>|null */
    private function learnerMessages(User $user): ?array
    {
        return $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNER_MESSAGES, AccessLevel::READ))
            ? $this->learnerMessages->handle()
            : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function adminPanel(User $user): ?array
    {
        $canReviewFeedback = $user->can(PermissionCatalog::ability(PermissionCatalog::JOURNAL_FEEDBACK, AccessLevel::READ));
        $canManageCompetenceTopics = $user->can(PermissionCatalog::ability(PermissionCatalog::COMPETENCE_TOPICS, AccessLevel::READ));
        $canManageLearningConcepts = $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNING_CONCEPTS, AccessLevel::READ));
        $canModerateOrganizations = $user->can(PermissionCatalog::ability(PermissionCatalog::ORGANIZATION_MODERATION, AccessLevel::READ));

        if (! $canReviewFeedback && ! $canManageCompetenceTopics && ! $canManageLearningConcepts && ! $canModerateOrganizations) {
            return null;
        }

        return [
            'metrics' => $this->metrics->handle(),
            'competenceTopics' => $canManageCompetenceTopics
                ? $this->competenceTopics->handle()
                : [],
            'learningConcepts' => $canManageLearningConcepts
                ? $this->learningConcepts->handle()
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
        if (! $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNER_SUPPORT_SIGNALS, AccessLevel::READ))) {
            return null;
        }

        $settings = $this->supportSignals->handle($user);
        $canGrantManualUnlocks = $user->can(PermissionCatalog::ability(PermissionCatalog::WORLD_NODES, AccessLevel::UPDATE));

        return [
            ...$settings,
            'canGrantManualUnlocks' => $canGrantManualUnlocks,
            'manualUnlockTargets' => $canGrantManualUnlocks
                ? $this->manualUnlockTargets->handle($user)
                : [],
        ];
    }
}
