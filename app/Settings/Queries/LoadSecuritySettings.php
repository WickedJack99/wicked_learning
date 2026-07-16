<?php

namespace App\Settings\Queries;

use App\Models\User;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Features;

class LoadSecuritySettings
{
    /**
     * @return array<string, mixed>
     */
    public function handle(User $user): array
    {
        $canManagePasskeys = Features::canManagePasskeys();
        $canManageTwoFactor = Features::canManageTwoFactorAuthentication();

        $settings = [
            'canManageTwoFactor' => $canManageTwoFactor,
            'canManagePasskeys' => $canManagePasskeys,
            'passkeys' => $canManagePasskeys ? $this->passkeys($user) : [],
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ];

        if ($canManageTwoFactor) {
            $settings['twoFactorEnabled'] = $user->hasEnabledTwoFactorAuthentication();
            $settings['requiresConfirmation'] = Features::optionEnabled(
                Features::twoFactorAuthentication(),
                'confirm',
            );
        }

        return $settings;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function passkeys(User $user): array
    {
        return $user
            ->passkeys()
            ->select(['id', 'name', 'credential', 'created_at', 'last_used_at'])
            ->latest()
            ->get()
            ->map(fn ($passkey): array => [
                'id' => $passkey->id,
                'name' => $passkey->name,
                'authenticator' => $passkey->authenticator,
                'created_at_diff' => $passkey->created_at->diffForHumans(),
                'last_used_at_diff' => $passkey->last_used_at?->diffForHumans(),
            ])
            ->values()
            ->all();
    }
}
