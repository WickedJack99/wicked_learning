<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\Actions\RecordAccessChange;
use App\Access\PermissionCatalog;
use App\Http\Controllers\Controller;
use App\Models\RegistrationToken;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function __construct(private readonly RecordAccessChange $recordAccessChange) {}

    public function storeRegistrationToken(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', Rule::in($request->user()->assignableRoles())],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $plainToken = RegistrationToken::createFor(
            $request->user(),
            $data['roles'],
            $data['expires_at'] ?? null,
            filled($data['note'] ?? null) ? trim($data['note']) : null,
        );

        return $this->redirectToSettingsAccess($request)
            ->with('created_registration_token', $plainToken);
    }

    public function updateAccess(Request $request, User $user): RedirectResponse
    {
        $this->preventSelfLockout($request, $user);

        $data = $request->validate([
            'login_disabled' => ['required', 'boolean'],
            'banned_until' => ['nullable', 'date'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', Rule::in($request->user()->assignableRoles())],
        ]);

        $before = [
            'banned_until' => $user->banned_until?->toIso8601String(),
            'login_disabled' => $user->login_disabled_at !== null,
            'roles' => $user->assignedRoles(),
        ];

        $user->setAssignedRoles($data['roles']);
        $user->forceFill([
            'login_disabled_at' => $data['login_disabled']
                ? ($user->login_disabled_at ?? now())
                : null,
            'banned_until' => $data['banned_until'] ?? null,
        ])->save();

        $after = [
            'banned_until' => $user->fresh()->banned_until?->toIso8601String(),
            'login_disabled' => $user->login_disabled_at !== null,
            'roles' => $user->assignedRoles(),
        ];
        $changes = [];

        foreach ($before as $field => $value) {
            if ($value !== $after[$field]) {
                $changes[$field] = [
                    'before' => $value,
                    'after' => $after[$field],
                ];
            }
        }

        if ($changes !== []) {
            $this->recordAccessChange->handle($request->user(), $user, $changes);
        }

        return $this->redirectToSettingsAccess($request);
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->preventSelfLockout($request, $user);

        $user->delete();

        return $this->redirectToSettingsAccess($request);
    }

    private function preventSelfLockout(Request $request, User $user): void
    {
        if (! $request->user()->is($user)) {
            return;
        }

        throw ValidationException::withMessages([
            'user' => 'You cannot disable, ban or delete your own admin account.',
        ]);
    }

    private function redirectToSettingsAccess(Request $request): RedirectResponse
    {
        $parameters = $request->user()->can(
            PermissionCatalog::ability(PermissionCatalog::USERS, AccessLevel::READ),
        )
            ? ['panel' => 'admin-access', 'access' => 'users']
            : [];

        return redirect()->route('settings.index', $parameters);
    }
}
