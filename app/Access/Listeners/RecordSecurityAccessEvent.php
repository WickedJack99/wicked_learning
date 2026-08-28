<?php

namespace App\Access\Listeners;

use App\Access\Actions\RecordAccessChange;
use App\Models\AccessChangeEvent;
use App\Models\User;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationEnabled;
use Laravel\Passkeys\Events\PasskeyDeleted;
use Laravel\Passkeys\Events\PasskeyRegistered;

class RecordSecurityAccessEvent
{
    public function __construct(
        private RecordAccessChange $recordAccessChange,
    ) {}

    public function twoFactorEnabled(TwoFactorAuthenticationEnabled $event): void
    {
        $this->recordTwoFactorChange($event->user, true);
    }

    public function twoFactorDisabled(TwoFactorAuthenticationDisabled $event): void
    {
        $this->recordTwoFactorChange($event->user, false);
    }

    public function passkeyRegistered(PasskeyRegistered $event): void
    {
        $this->recordPasskeyChange($event->user, true);
    }

    public function passkeyDeleted(PasskeyDeleted $event): void
    {
        $this->recordPasskeyChange($event->user, false);
    }

    private function recordTwoFactorChange(mixed $user, bool $enabled): void
    {
        if (! $user instanceof User) {
            return;
        }

        $this->recordAccessChange->handle(
            $user,
            $user,
            [
                'security_factor' => [
                    'before' => $enabled
                        ? 'Two-factor authentication disabled'
                        : 'Two-factor authentication enabled',
                    'after' => $enabled
                        ? 'Two-factor authentication enabled'
                        : 'Two-factor authentication disabled',
                ],
            ],
            $enabled
                ? AccessChangeEvent::ACTION_TWO_FACTOR_ENABLED
                : AccessChangeEvent::ACTION_TWO_FACTOR_DISABLED,
        );
    }

    private function recordPasskeyChange(mixed $user, bool $registered): void
    {
        if (! $user instanceof User) {
            return;
        }

        $this->recordAccessChange->handle(
            $user,
            $user,
            [
                'security_factor' => [
                    'before' => $registered ? 'No passkey registered' : 'Passkey registered',
                    'after' => $registered ? 'Passkey registered' : 'Passkey removed',
                ],
            ],
            $registered
                ? AccessChangeEvent::ACTION_PASSKEY_REGISTERED
                : AccessChangeEvent::ACTION_PASSKEY_DELETED,
        );
    }
}
