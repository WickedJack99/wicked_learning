<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Learning\Actions\RespondToLearnerJournalFeedback;
use App\Learning\Actions\SyncCompetenceTopicDefinitions;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\OrganizationIconReport;
use App\Organizations\Actions\ResolveOrganizationIconReport;
use App\Organizations\Actions\UpdateOrganizationSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Coordinates the initial administration overview and journal feedback queue. */
class AdminPanelController extends Controller
{
    public function __construct(
        private readonly SyncCompetenceTopicDefinitions $syncCompetenceTopics,
        private readonly RespondToLearnerJournalFeedback $respondToFeedback,
        private readonly ResolveOrganizationIconReport $resolveIconReport,
        private readonly UpdateOrganizationSettings $updateOrganizationSettings,
    ) {}

    public function index(Request $request): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-learning-support',
            'support' => 'admin-panel',
        ]);
    }

    public function updateCompetenceTopics(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'topics' => ['present', 'array', 'max:200'],
            'topics.*.aura_threshold' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'topics.*.description' => ['nullable', 'string', 'max:2000'],
            'topics.*.emittance_threshold' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'topics.*.growth_threshold' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'topics.*.is_active' => ['required', 'boolean'],
            'topics.*.name' => ['required', 'string', 'max:120'],
        ]);

        $this->syncCompetenceTopics->handle($data['topics']);

        return back();
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
