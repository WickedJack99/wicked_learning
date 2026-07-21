<?php

namespace App\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationJoinRequest;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Organizations\OrganizationGovernance;
use App\Organizations\OrganizationMembershipLimit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RespondToOrganizationJoinRequest
{
    public function __construct(
        private readonly OrganizationGovernance $governance,
        private readonly OrganizationMembershipLimit $membershipLimit,
    ) {}

    public function handle(OrganizationJoinRequest $request, User $leader, bool $approved): void
    {
        $organization = $request->organization;

        if (! $organization->isLeader($leader)) {
            throw ValidationException::withMessages([
                'organization' => 'Only organization leaders can review join requests.',
            ]);
        }

        DB::transaction(function () use ($approved, $leader, $organization, $request): void {
            if ($approved) {
                $this->membershipLimit->assertCanJoin($request->requester);

                $membership = OrganizationMembership::query()->firstOrCreate(
                    [
                        'organization_id' => $request->organization_id,
                        'user_id' => $request->user_id,
                    ],
                    [
                        'role' => $this->governance->roleForNewMember($organization),
                        'joined_at' => now(),
                    ],
                );

                if ($organization->governance_type === Organization::GOVERNANCE_ANARCHY) {
                    $membership->forceFill([
                        'role' => OrganizationMembership::ROLE_LEADER,
                    ])->save();
                }
            }

            $request->forceFill([
                'status' => $approved
                    ? OrganizationJoinRequest::STATUS_APPROVED
                    : OrganizationJoinRequest::STATUS_DECLINED,
                'reviewed_by_user_id' => $leader->id,
                'reviewed_at' => now(),
            ])->save();
        });
    }
}
