<?php

namespace App\Providers;

use App\Access\AccessLevel;
use App\Access\Listeners\RecordSecurityAccessEvent;
use App\Access\PermissionCatalog;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationEnabled;
use Laravel\Passkeys\Events\PasskeyDeleted;
use Laravel\Passkeys\Events\PasskeyRegistered;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureSecurityAuditListeners();
        $this->configureDefaults();
    }

    private function configureSecurityAuditListeners(): void
    {
        Event::listen(
            TwoFactorAuthenticationEnabled::class,
            [RecordSecurityAccessEvent::class, 'twoFactorEnabled'],
        );
        Event::listen(
            TwoFactorAuthenticationDisabled::class,
            [RecordSecurityAccessEvent::class, 'twoFactorDisabled'],
        );
        Event::listen(
            PasskeyRegistered::class,
            [RecordSecurityAccessEvent::class, 'passkeyRegistered'],
        );
        Event::listen(
            PasskeyDeleted::class,
            [RecordSecurityAccessEvent::class, 'passkeyDeleted'],
        );
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        foreach (PermissionCatalog::resourceKeys() as $resource) {
            Gate::define(
                PermissionCatalog::ability($resource, AccessLevel::READ),
                fn (User $user): bool => in_array($resource, [
                    PermissionCatalog::WORLD_MAPS,
                    PermissionCatalog::WORLD_NODES,
                    PermissionCatalog::WORLD_ACTIVITIES,
                ], true)
                    ? app(LearningMapEditAccessService::class)->hasAnyEditableMap($user)
                    : $user->hasAccess($resource, AccessLevel::READ),
            );
            Gate::define(
                PermissionCatalog::ability($resource, AccessLevel::UPDATE),
                fn (User $user): bool => in_array($resource, [
                    PermissionCatalog::WORLD_MAPS,
                    PermissionCatalog::WORLD_NODES,
                    PermissionCatalog::WORLD_ACTIVITIES,
                ], true)
                    ? app(LearningMapEditAccessService::class)->hasAnyEditableMap($user)
                    : $user->hasAccess($resource, AccessLevel::UPDATE),
            );
            Gate::define(
                PermissionCatalog::ability($resource, AccessLevel::DELETE),
                fn (User $user): bool => $user->hasAccess($resource, AccessLevel::DELETE),
            );
        }

        Gate::define(
            'manage-users',
            fn (User $user): bool => $user->hasAccess(PermissionCatalog::USERS, AccessLevel::READ),
        );

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
