<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationJoinRequest;
use App\Models\OrganizationMembership;
use App\Models\OrganizationMessage;
use App\Organizations\Actions\DeleteOrganizationMessage;
use App\Organizations\Actions\HideOrganizationMessage;
use App\Organizations\Actions\LeaveOrganization;
use App\Organizations\Actions\PromoteOrganizationMember;
use App\Organizations\Actions\ReportOrganizationIcon;
use App\Organizations\Actions\RequestOrganizationMembership;
use App\Organizations\Actions\RespondToOrganizationJoinRequest;
use App\Organizations\Actions\SaveOrganization;
use App\Organizations\Actions\SendOrganizationMessage;
use App\Organizations\Actions\UpdateOrganizationIcon;
use App\Organizations\OrganizationGovernance;
use App\Organizations\Queries\LoadOrganizations;
use App\Organizations\Serializers\OrganizationSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function __construct(
        private readonly OrganizationGovernance $governance,
        private readonly LoadOrganizations $organizations,
        private readonly OrganizationSerializer $serializer,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('organizations/index', [
            'organizations' => $this->organizations
                ->handle($request->user())
                ->map(fn (Organization $organization): Organization => $this->governance->ensureCurrentLeadership($organization))
                ->map(fn (Organization $organization): array => $this->serializer->card($organization, $request->user()))
                ->values()
                ->all(),
        ]);
    }

    public function show(Request $request, Organization $organization): Response
    {
        $this->governance->ensureCurrentLeadership($organization);

        return Inertia::render('organizations/show', [
            'organization' => $this->serializer->detail($organization, $request->user()),
        ]);
    }

    public function store(Request $request, SaveOrganization $save): RedirectResponse
    {
        $organization = $save->handle(
            $request->user(),
            $request->validate($this->rules(includeGovernance: true)),
        );

        return to_route('organizations.show', ['organization' => $organization->slug]);
    }

    public function update(Request $request, Organization $organization, SaveOrganization $save): RedirectResponse
    {
        $this->authorizeLeader($request, $organization);

        $save->handle($request->user(), $request->validate($this->rules()), $organization);

        return back();
    }

    public function destroy(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorizeLeader($request, $organization);

        $organization->delete();

        return to_route('organizations.index');
    }

    public function uploadIcon(Request $request, Organization $organization, UpdateOrganizationIcon $upload): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        return response()->json($upload->handle($organization, $request->user(), $data['file']));
    }

    public function requestMembership(
        Request $request,
        Organization $organization,
        RequestOrganizationMembership $requestMembership,
    ): RedirectResponse {
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:1000'],
        ]);

        $requestMembership->handle($organization, $request->user(), $data['message'] ?? null);

        return back();
    }

    public function respondToJoinRequest(
        Request $request,
        OrganizationJoinRequest $joinRequest,
        RespondToOrganizationJoinRequest $respond,
    ): RedirectResponse {
        $data = $request->validate([
            'approved' => ['required', 'boolean'],
        ]);

        $respond->handle($joinRequest, $request->user(), (bool) $data['approved']);

        return back();
    }

    public function leave(Request $request, Organization $organization, LeaveOrganization $leave): RedirectResponse
    {
        $leave->handle($organization, $request->user());

        return to_route('organizations.show', ['organization' => $organization->slug]);
    }

    public function promoteMember(
        Request $request,
        OrganizationMembership $membership,
        PromoteOrganizationMember $promote,
    ): RedirectResponse {
        $promote->handle($membership, $request->user());

        return back();
    }

    public function storeMessage(
        Request $request,
        Organization $organization,
        SendOrganizationMessage $sendMessage,
    ): RedirectResponse {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $sendMessage->handle($organization, $request->user(), $data['body']);

        return back();
    }

    public function destroyMessage(
        Request $request,
        OrganizationMessage $message,
        DeleteOrganizationMessage $delete,
    ): RedirectResponse {
        $delete->handle($message, $request->user());

        return back();
    }

    public function hideMessage(
        Request $request,
        OrganizationMessage $message,
        HideOrganizationMessage $hide,
    ): RedirectResponse {
        $hide->handle($message, $request->user());

        return back();
    }

    public function reportIcon(
        Request $request,
        Organization $organization,
        ReportOrganizationIcon $reportIcon,
    ): RedirectResponse {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $reportIcon->handle($organization, $request->user(), $data['reason'] ?? null);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $includeGovernance = false): array
    {
        return [
            ...($includeGovernance ? [
                'governance_type' => ['nullable', Rule::in(Organization::GOVERNANCE_TYPES)],
            ] : []),
            'name' => ['required', 'string', 'max:120'],
            'slogan' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:4000'],
        ];
    }

    private function authorizeLeader(Request $request, Organization $organization): void
    {
        abort_unless($request->user() && $organization->isLeader($request->user()), 403);
    }
}
