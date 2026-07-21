<?php

namespace App\Providers;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Learning\Services\LearningMapEditAccessService;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

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
        $this->configureDefaults();
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
                fn (User $user): bool => $resource === PermissionCatalog::WORLDS
                    ? app(LearningMapEditAccessService::class)->hasAnyEditableMap($user)
                    : $user->hasAccess($resource, AccessLevel::READ),
            );
            Gate::define(
                PermissionCatalog::ability($resource, AccessLevel::UPDATE),
                fn (User $user): bool => $resource === PermissionCatalog::WORLDS
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
