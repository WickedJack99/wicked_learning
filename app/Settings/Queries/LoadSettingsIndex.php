<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Access\Queries\LoadAccessRoles;
use App\Access\Serializers\AccessRoleSerializer;
use App\Learning\Queries\LoadAdminLearningGroups;
use App\Learning\Serializers\LearningGroupSerializer;
use App\Models\AccessRole;
use App\Models\LearningGroup;
use App\Models\PlatformInfoPage;
use App\Models\RegistrationToken;
use App\Models\User;
use DateTimeInterface;

class LoadSettingsIndex
{
    public function __construct(
        private readonly LoadAccessRoles $loadAccessRoles,
        private readonly AccessRoleSerializer $roleSerializer,
        private readonly LoadAdminLearningGroups $loadLearningGroups,
        private readonly LearningGroupSerializer $learningGroupSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(User $user, ?string $createdRegistrationToken): array
    {
        $accessCapabilities = $this->accessCapabilities($user);
        $canManageUsers = $user->can(PermissionCatalog::ability(PermissionCatalog::USERS, AccessLevel::READ));
        $canManageGroups = $user->can(PermissionCatalog::ability(PermissionCatalog::GROUPS, AccessLevel::READ));
        $canManageRoles = $user->can(PermissionCatalog::ability(PermissionCatalog::ROLES, AccessLevel::READ));
        $canManagePresentation = $user->can(PermissionCatalog::ability(PermissionCatalog::PRESENTATION, AccessLevel::READ));

        return [
            'canManageUsers' => $canManageUsers,
            'canAccessAdministration' => $this->canAccessAdministration($accessCapabilities),
            'accessCapabilities' => $accessCapabilities,
            'accessGroups' => $canManageGroups ? $this->accessGroups($user) : [],
            'accessGroupUsers' => ($canManageUsers || $canManageGroups) ? $this->accessGroupUsers() : [],
            'assignableRegistrationRoles' => $user->assignableRoles(),
            'adminUsers' => $canManageUsers ? $this->adminUsers() : [],
            'registrationTokens' => $canManageUsers ? $this->registrationTokens() : [],
            'adminRoles' => $canManageRoles ? $this->accessRoles() : [],
            'permissionResources' => $this->permissionResources(),
            'platformInfoPages' => $canManagePresentation ? $this->platformInfoPages() : [],
            'createdRegistrationToken' => $createdRegistrationToken,
        ];
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     */
    private function canAccessAdministration(array $capabilities): bool
    {
        foreach ($capabilities as $resource) {
            if ($resource['read']) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, array{read: bool, update: bool, delete: bool}>
     */
    private function accessCapabilities(User $user): array
    {
        return collect(PermissionCatalog::resourceKeys())
            ->mapWithKeys(fn (string $resource): array => [
                $resource => [
                    'read' => $user->can(PermissionCatalog::ability($resource, AccessLevel::READ)),
                    'update' => $user->can(PermissionCatalog::ability($resource, AccessLevel::UPDATE)),
                    'delete' => $user->can(PermissionCatalog::ability($resource, AccessLevel::DELETE)),
                ],
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function accessRoles(): array
    {
        return $this->loadAccessRoles
            ->handle()
            ->map(fn (AccessRole $role): array => $this->roleSerializer->serialize($role))
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function accessGroups(User $user): array
    {
        return $this->loadLearningGroups
            ->handle()
            ->filter(fn (LearningGroup $group): bool => $this->canSeeGroup($user, $group))
            ->map(fn (LearningGroup $group): array => $this->learningGroupSerializer->forAdmin($group))
            ->values()
            ->all();
    }

    private function canSeeGroup(User $user, LearningGroup $group): bool
    {
        $scope = $user->accessScopeFor(PermissionCatalog::GROUPS, AccessLevel::READ);

        if (AccessScope::allows($scope, AccessScope::ALL)) {
            return true;
        }

        if (
            AccessScope::allows($scope, AccessScope::OWN)
            && (int) $group->created_by_user_id === (int) $user->id
        ) {
            return true;
        }

        return AccessScope::allows($scope, AccessScope::ASSIGNED)
            && $user->managesLearningGroup($group);
    }

    /**
     * @return array<int, array{id: int, name: string, email: string}>
     */
    private function accessGroupUsers(): array
    {
        return User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user): array => $this->userReference($user))
            ->all();
    }

    /**
     * @return array<int, array{key: string, label: string, description: string, group: string}>
     */
    private function permissionResources(): array
    {
        return collect(PermissionCatalog::resources())
            ->map(fn (array $resource, string $key): array => [
                'key' => $key,
                'label' => $resource['label'],
                'description' => $resource['description'],
                'group' => $resource['group'],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, array{key: string, markdown: string|null, updated_at: string|null, updated_by: array{id: int, name: string, email: string}|null}>
     */
    private function platformInfoPages(): array
    {
        $pages = PlatformInfoPage::query()
            ->with('updatedBy:id,name,email')
            ->whereIn('key', ['about', 'imprint', 'data-protection'])
            ->get()
            ->keyBy('key');

        return collect(['about', 'imprint', 'data-protection'])
            ->mapWithKeys(function (string $key) use ($pages): array {
                $page = $pages->get($key);

                return [
                    $key => [
                        'key' => $key,
                        'markdown' => $page?->markdown,
                        'updated_at' => $this->dateForFrontend($page?->updated_at),
                        'updated_by' => $page?->updatedBy
                            ? $this->userReference($page->updatedBy)
                            : null,
                    ],
                ];
            })
            ->all();
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
