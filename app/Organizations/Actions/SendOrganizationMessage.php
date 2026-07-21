<?php

namespace App\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationMessage;
use App\Models\User;
use App\Support\ConsecutiveMessageRateLimiter;
use Illuminate\Validation\ValidationException;

class SendOrganizationMessage
{
    public function __construct(private readonly ConsecutiveMessageRateLimiter $rateLimiter) {}

    public function handle(Organization $organization, User $user, string $body): OrganizationMessage
    {
        if (! $organization->isMember($user)) {
            throw ValidationException::withMessages([
                'organization' => 'Only members can chat inside this organization.',
            ]);
        }

        $this->rateLimiter->assertCanSend($organization->messages(), $user);

        return $organization->messages()->create([
            'user_id' => $user->id,
            'body' => trim($body),
        ])->load('user');
    }
}
