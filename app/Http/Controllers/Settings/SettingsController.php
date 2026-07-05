<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\RegistrationToken;
use App\Models\User;
use DateTimeInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canManageUsers = $user->can('manage-users');

        return Inertia::render('settings/index', [
            'canManageUsers' => $canManageUsers,
            'assignableRegistrationRoles' => $user->assignableRoles(),
            'adminUsers' => $canManageUsers ? $this->adminUsers() : [],
            'registrationTokens' => $canManageUsers ? $this->registrationTokens() : [],
            'createdRegistrationToken' => $request->session()->get('created_registration_token'),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function adminUsers(): array
    {
        return User::query()
            ->with([
                'registrationToken.createdBy:id,name,email',
                'registrationToken.usedBy:id,name,email',
            ])
            ->latest()
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'roles' => $user->assignedRoles(),
                'created_at' => $this->dateForFrontend($user->created_at),
                'login_disabled_at' => $this->dateForFrontend($user->login_disabled_at),
                'banned_until' => $this->dateForFrontend($user->banned_until),
                'is_login_disabled' => $user->login_disabled_at !== null,
                'is_currently_banned' => $user->isCurrentlyBanned(),
                'registration_token' => $user->registrationToken
                    ? $this->tokenSummary($user->registrationToken)
                    : null,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function registrationTokens(): array
    {
        return RegistrationToken::query()
            ->with(['createdBy:id,name,email', 'usedBy:id,name,email'])
            ->latest()
            ->limit(25)
            ->get()
            ->map(fn (RegistrationToken $token): array => $this->tokenSummary($token))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenSummary(RegistrationToken $token): array
    {
        return [
            'id' => $token->id,
            'role' => $token->role,
            'roles' => $token->grantedRoles(),
            'created_at' => $this->dateForFrontend($token->created_at),
            'used_at' => $this->dateForFrontend($token->used_at),
            'expires_at' => $this->dateForFrontend($token->expires_at),
            'is_used' => $token->used_at !== null,
            'is_expired' => $token->isExpired(),
            'created_by' => $token->createdBy
                ? $this->userReference($token->createdBy)
                : null,
            'used_by' => $token->usedBy
                ? $this->userReference($token->usedBy)
                : null,
        ];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function userReference(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    private function dateForFrontend(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
