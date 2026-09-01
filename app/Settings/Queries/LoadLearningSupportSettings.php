<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadAdminJournalFeedbackRequests;
use App\Learning\Queries\LoadAdminPanelMetrics;
use App\Learning\Queries\LoadAdminPlatformFeedback;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadLearnerManualUnlockTargets;
use App\Learning\Queries\LoadLearnerMessageModeration;
use App\Learning\Queries\LoadLearnerSupportSignals;
use App\Learning\Queries\LoadLearningConcepts;
use App\Learning\Serializers\AdminJournalFeedbackRequestSerializer;
use App\Learning\Serializers\AdminPlatformFeedbackSerializer;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\OrganizationIconReport;
use App\Models\PlatformFeedback;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformOrganizationSetting;
use App\Models\User;
use App\Organizations\Queries\LoadPendingOrganizationIconReports;
use App\Organizations\Serializers\OrganizationIconReportSerializer;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

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
        private readonly LoadAdminPlatformFeedback $platformFeedback,
        private readonly AdminPlatformFeedbackSerializer $platformFeedbackSerializer,
        private readonly LoadPendingOrganizationIconReports $iconReports,
        private readonly OrganizationIconReportSerializer $iconReportSerializer,
        private readonly PlatformJournalSettingsSerializer $journalSettingsSerializer,
    ) {}

    /** @return array{adminPanel: array<string, mixed>|null, journal: array<string, mixed>|null, learnerMessages: array{topics: array<int, array<string, mixed>>}|null, platformFeedback: array<string, mixed>|null, supportSignals: array<string, mixed>|null} */
    public function handle(User $user, int $feedbackPage = 1, int $platformFeedbackPage = 1): array
    {
        return [
            'adminPanel' => $this->adminPanel($user, $feedbackPage),
            'journal' => $this->journal($user),
            'learnerMessages' => $this->learnerMessages($user),
            'platformFeedback' => $this->platformFeedback($user, $platformFeedbackPage),
            'supportSignals' => $this->supportSignals($user),
        ];
    }

    /** @return array{topics: array<int, array<string, mixed>>}|null */
    private function learnerMessages(User $user): ?array
    {
        return $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNER_MESSAGES, AccessLevel::READ))
            ? ['topics' => $this->learnerMessages->topics()]
            : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function adminPanel(User $user, int $feedbackPage): ?array
    {
        $canReviewFeedback = $user->can(PermissionCatalog::ability(PermissionCatalog::JOURNAL_FEEDBACK, AccessLevel::READ));
        $canManageCompetenceTopics = $user->can(PermissionCatalog::ability(PermissionCatalog::COMPETENCE_TOPICS, AccessLevel::READ));
        $canManageLearningConcepts = $user->can(PermissionCatalog::ability(PermissionCatalog::LEARNING_CONCEPTS, AccessLevel::READ));
        $canModerateOrganizations = $user->can(PermissionCatalog::ability(PermissionCatalog::ORGANIZATION_MODERATION, AccessLevel::READ));

        if (! $canReviewFeedback && ! $canManageCompetenceTopics && ! $canManageLearningConcepts && ! $canModerateOrganizations) {
            return null;
        }

        $feedbackRequests = $canReviewFeedback
            ? $this->feedbackRequests->handle($feedbackPage)
            : null;

        return [
            'metrics' => $this->metrics->handle(),
            'competenceTopics' => $canManageCompetenceTopics
                ? $this->competenceTopics->handle()
                : [],
            'learningConcepts' => $canManageLearningConcepts
                ? $this->learningConcepts->handle()
                : [],
            'feedbackRequests' => $canReviewFeedback
                ? $feedbackRequests?->getCollection()
                    ->map(fn (LearnerJournalFeedbackRequest $feedbackRequest): array => $this->feedbackSerializer->feedbackRequest($feedbackRequest))
                    ->values()
                    ->all()
                : [],
            'feedbackRequestsPagination' => $feedbackRequests
                ? $this->pagination($feedbackRequests)
                : [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => LoadAdminJournalFeedbackRequests::PAGE_SIZE,
                    'total' => 0,
                ],
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

    /** @return array{items: array<int, array<string, mixed>>, pagination: array<string, int>}|null */
    private function platformFeedback(User $user, int $page): ?array
    {
        if (! $user->can(PermissionCatalog::ability(PermissionCatalog::PLATFORM_FEEDBACK, AccessLevel::READ))) {
            return null;
        }

        $feedback = $this->platformFeedback->handle($page);

        return [
            'items' => $feedback->getCollection()
                ->map(fn (PlatformFeedback $item): array => $this->platformFeedbackSerializer->serialize($item))
                ->values()
                ->all(),
            'pagination' => $this->pagination($feedback),
        ];
    }

    /** @return array{currentPage: int, lastPage: int, perPage: int, total: int} */
    private function pagination(LengthAwarePaginator $paginator): array
    {
        return [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
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
