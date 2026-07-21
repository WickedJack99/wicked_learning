<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\RespondToLearnerJournalFeedback;
use App\Learning\Queries\LoadAdminJournalFeedbackRequests;
use App\Learning\Queries\LoadAdminPanelMetrics;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Serializers\AdminJournalFeedbackRequestSerializer;
use App\Learning\Serializers\AdminWorldGraphSerializer;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\OrganizationIconReport;
use App\Models\PlatformOrganizationSetting;
use App\Organizations\Actions\ResolveOrganizationIconReport;
use App\Organizations\Actions\UpdateOrganizationSettings;
use App\Organizations\Queries\LoadPendingOrganizationIconReports;
use App\Organizations\Serializers\OrganizationIconReportSerializer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Coordinates the initial administration overview and journal feedback queue. */
class AdminPanelController extends Controller
{
    public function __construct(
        private readonly LoadAdminPanelMetrics $metrics,
        private readonly LoadEditableWorldGraph $worldGraph,
        private readonly LoadAdminJournalFeedbackRequests $feedbackRequests,
        private readonly AdminJournalFeedbackRequestSerializer $serializer,
        private readonly AdminWorldGraphSerializer $worldGraphSerializer,
        private readonly RespondToLearnerJournalFeedback $respondToFeedback,
        private readonly LoadPendingOrganizationIconReports $iconReports,
        private readonly OrganizationIconReportSerializer $iconReportSerializer,
        private readonly ResolveOrganizationIconReport $resolveIconReport,
        private readonly UpdateOrganizationSettings $updateOrganizationSettings,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('settings/admin-panel', [
            'metrics' => $this->metrics->handle(),
            'feedbackRequests' => $this->feedbackRequests->handle()
                ->map(fn (LearnerJournalFeedbackRequest $feedbackRequest): array => $this->serializer->feedbackRequest($feedbackRequest))
                ->values(),
            'organizationIconReports' => $this->iconReports->handle()
                ->map(fn (OrganizationIconReport $report): array => $this->iconReportSerializer->serialize($report))
                ->values(),
            'organizationSettings' => [
                'maxMembershipsPerUser' => PlatformOrganizationSetting::current()->max_memberships_per_user,
            ],
            'worldGraph' => $this->worldGraphSerializer->serialize(
                $this->worldGraph->handle($request->user()),
            ),
        ]);
    }

    public function respond(Request $request, LearnerJournalFeedbackRequest $feedbackRequest): RedirectResponse
    {
        $data = $request->validate([
            'feedback' => ['required', 'string', 'max:20000'],
        ]);

        $this->respondToFeedback->handle($request->user(), $feedbackRequest, $data['feedback']);

        return back();
    }

    public function updateOrganizationSettings(Request $request): RedirectResponse
    {
        $this->updateOrganizationSettings->handle($request->validate([
            'max_memberships_per_user' => ['required', 'integer', 'min:1', 'max:100'],
        ]));

        return back();
    }

    public function resolveOrganizationIconReport(Request $request, OrganizationIconReport $report): RedirectResponse
    {
        $data = $request->validate([
            'remove_icon' => ['required', 'boolean'],
        ]);

        $this->resolveIconReport->handle($report, $request->user(), (bool) $data['remove_icon']);

        return back();
    }
}
