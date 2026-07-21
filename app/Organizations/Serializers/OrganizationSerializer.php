<?php

namespace App\Organizations\Serializers;

use App\Models\Organization;
use App\Models\OrganizationJoinRequest;
use App\Models\OrganizationMembership;
use App\Models\OrganizationMessage;
use App\Models\User;
use DateTimeInterface;

class OrganizationSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function card(Organization $organization, ?User $viewer = null): array
    {
        return [
            ...$this->base($organization),
            'viewerMembership' => $viewer ? $this->viewerMembership($organization, $viewer) : null,
            'viewerJoinRequest' => $viewer ? $this->viewerJoinRequest($organization, $viewer) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(Organization $organization, User $viewer): array
    {
        $organization->loadMissing([
            'memberships.user:id,name,email',
            'joinRequests.requester:id,name,email',
            'messages' => fn ($query) => $query
                ->when(! $viewer->isAdmin(), fn ($query) => $query->whereNull('hidden_at'))
                ->latest()
                ->limit(80),
            'messages.hiddenBy:id,name,email',
            'messages.user:id,name,email',
        ]);

        $isLeader = $organization->isLeader($viewer);
        $canViewMessages = $organization->isMember($viewer) || $viewer->isAdmin();

        return [
            ...$this->card($organization, $viewer),
            'canModerateMessages' => $viewer->isAdmin(),
            'canSendMessages' => $organization->isMember($viewer),
            'isLeader' => $isLeader,
            'members' => $organization->memberships
                ->map(fn (OrganizationMembership $membership): array => $this->membership($membership))
                ->values()
                ->all(),
            'messages' => $canViewMessages
                ? $organization->messages
                    ->sortBy('created_at')
                    ->map(fn (OrganizationMessage $message): array => $this->message($message, $viewer))
                    ->values()
                    ->all()
                : [],
            'joinRequests' => $isLeader
                ? $organization->joinRequests
                    ->where('status', OrganizationJoinRequest::STATUS_PENDING)
                    ->map(fn (OrganizationJoinRequest $request): array => $this->joinRequest($request))
                    ->values()
                    ->all()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function base(Organization $organization): array
    {
        $organization->loadCount('memberships');

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'slogan' => $organization->slogan,
            'description' => $organization->description,
            'governanceType' => $organization->governance_type,
            'iconUrl' => $organization->icon_url,
            'leadershipRotatedAt' => $this->date($organization->leadership_rotated_at),
            'memberCount' => $organization->memberships_count ?? $organization->memberships()->count(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function viewerMembership(Organization $organization, User $viewer): ?array
    {
        $membership = $organization->memberships()
            ->where('user_id', $viewer->id)
            ->first();

        return $membership ? $this->membership($membership) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function viewerJoinRequest(Organization $organization, User $viewer): ?array
    {
        $request = $organization->joinRequests()
            ->where('user_id', $viewer->id)
            ->latest()
            ->first();

        return $request ? $this->joinRequest($request) : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function membership(OrganizationMembership $membership): array
    {
        $membership->loadMissing('user:id,name,email');

        return [
            'id' => $membership->id,
            'role' => $membership->role,
            'joinedAt' => $this->date($membership->joined_at),
            'user' => $this->user($membership->user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function joinRequest(OrganizationJoinRequest $request): array
    {
        $request->loadMissing('requester:id,name,email');

        return [
            'id' => $request->id,
            'status' => $request->status,
            'message' => $request->message,
            'createdAt' => $this->date($request->created_at),
            'requester' => $this->user($request->requester),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function message(OrganizationMessage $message, User $viewer): array
    {
        $message->loadMissing(['hiddenBy:id,name,email', 'user:id,name,email']);

        return [
            'id' => $message->id,
            'body' => $message->body,
            'canDelete' => $message->user_id === $viewer->id && $message->hidden_at === null,
            'canHide' => $viewer->isAdmin() && $message->hidden_at === null,
            'createdAt' => $this->date($message->created_at),
            'hiddenAt' => $this->date($message->hidden_at),
            'hiddenBy' => $message->hiddenBy ? $this->user($message->hiddenBy) : null,
            'user' => $this->user($message->user),
        ];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    private function date(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
