<?php

namespace App\Http\Controllers\Settings;

use App\Access\Actions\RecordAccessChange;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use App\Models\AccessChangeEvent;
use App\Settings\Queries\LoadSecuritySettings;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    public function __construct(
        private readonly LoadSecuritySettings $securitySettings,
        private readonly RecordAccessChange $recordAccessChange,
    ) {}

    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $request->ensureStateIsValid();

        return Inertia::render('settings/security', $this->securitySettings->handle($request->user()));
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);
        $this->recordAccessChange->handle(
            $request->user(),
            $request->user(),
            [
                'credential' => [
                    'before' => 'Password stored',
                    'after' => 'Password updated',
                ],
            ],
            AccessChangeEvent::ACTION_PASSWORD_UPDATED,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return back();
    }
}
