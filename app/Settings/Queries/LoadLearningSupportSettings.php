<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Queries\LoadAdminJournalFeedbackRequests;
use App\Learning\Queries\LoadAdminPanelMetrics;
use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Serializers\AdminJournalFeedbackRequestSerializer;
use App\Learning\Serializers\AdminWorldGraphSerializer;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\OrganizationIconReport;
use App\Models\PlatformJournalSetting;
use App\Models\PlatformOrganizationSetting;
use App\Models\User;
use App\Organizations\Queries\LoadPendingOrganizationIconReports;
use App\Organizations\Serializers\OrganizationIconReportSerializer;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class LoadLearningSupportSettings
{
    public function __construct(
        private readonly LoadAdminPanelMetrics $metrics,
        private readonly LoadEditableWorldGraph $worldGraph,
        private readonly LoadCompetenceTopicDefinitions $competenceTopics,
        private readonly LoadAdminJournalFeedbackRequests $feedbackRequests,
        private readonly AdminJournalFeedbackRequestSerializer $feedbackSerializer,
        private readonly AdminWorldGraphSerializer $worldGraphSerializer,
        private readonly LoadPendingOrganizationIconReports $iconReports,
        private readonly OrganizationIconReportSerializer $iconReportSerializer,
        private readonly PlatformJournalSettingsSerializer $journalSettingsSerializer,
    ) {}

    /**
     * @return array{adminPanel: array<string, mixed>|null, journal: array<string, mixed>|null}
     */
    public function handle(User $user): array
    {
        return [
            'adminPanel' => $this->adminPanel($user),
            'journal' => $this->journal($user),
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
        $canViewWorld = $user->can(PermissionCatalog::ability(PermissionCatalog::WORLD_MAPS, AccessLevel::READ));

        if (! $canReviewFeedback && ! $canManageCompetenceTopics && ! $canModerateOrganizations && ! $canViewWorld) {
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
            'worldGraph' => $canViewWorld ? $this->worldGraph($user) : ['maps' => []],
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
     * @return array<string, mixed>
     */
    private function worldGraph(User $user): array
    {
        try {
            return $this->worldGraphSerializer->serialize(
                $this->worldGraph->handle($user),
            );
        } catch (ModelNotFoundException) {
            return ['maps' => []];
        }
    }
}
