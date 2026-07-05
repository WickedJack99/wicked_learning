<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\RegistrationToken;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function storeRegistrationToken(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', Rule::in($request->user()->assignableRoles())],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $plainToken = RegistrationToken::createFor(
            $request->user(),
            $data['roles'],
            $data['expires_at'] ?? null,
        );

        return redirect()
            ->route('settings.index')
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

        $user->setAssignedRoles($data['roles']);
        $user->forceFill([
            'login_disabled_at' => $data['login_disabled']
                ? ($user->login_disabled_at ?? now())
                : null,
            'banned_until' => $data['banned_until'] ?? null,
        ])->save();

        return redirect()->route('settings.index');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->preventSelfLockout($request, $user);

        $user->delete();

        return redirect()->route('settings.index');
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
}
