<?php

namespace App\Settings\Queries;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Access\Queries\LoadAccessRoles;
use App\Access\Serializers\AccessRoleSerializer;
use App\Ai\Queries\LoadAiSettings;
use App\Learning\Queries\LoadAdminLearningGroups;
use App\Learning\Queries\LoadEditableActivityGraph;
use App\Learning\Queries\LoadEditableItems;
use App\Learning\Queries\LoadEditableMap;
use App\Learning\Queries\LoadEditableSounds;
use App\Learning\Queries\LoadEditableTools;
use App\Learning\Queries\LoadEditableWorldGraph;
use App\Learning\Queries\LoadLearningGroupOptions;
use App\Learning\Queries\LoadLearningMapAccessGroups;
use App\Learning\Queries\LoadReusableImageAssets;
use App\Learning\Serializers\AdminActivityGraphSerializer;
use App\Learning\Serializers\AdminItemSerializer;
use App\Learning\Serializers\AdminSoundSerializer;
use App\Learning\Serializers\AdminToolSerializer;
use App\Learning\Serializers\AdminWorldGraphSerializer;
use App\Learning\Serializers\EditableMapSerializer;
use App\Learning\Serializers\LearningGroupSerializer;
use App\Learning\Serializers\LearningItemSerializer;
use App\Learning\Services\LearningMapEditAccessService;
use App\Localization\Queries\LoadLanguageAdministration;
use App\Models\AccessRole;
use App\Models\LearnerJournalFeedbackRequest;
use App\Models\LearningGroup;
use App\Models\LearningItem;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningSound;
use App\Models\LearningTool;
use App\Models\OrganizationIconReport;
use App\Models\PlatformInfoPage;
use App\Models\PlatformPresentationSetting;
use App\Models\RegistrationToken;
use App\Models\User;
use DateTimeInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class LoadSettingsIndex
{
    public function __construct(
        private readonly LoadAccessRoles $loadAccessRoles,
        private readonly AccessRoleSerializer $roleSerializer,
        private readonly LoadAdminLearningGroups $loadLearningGroups,
        private readonly LearningGroupSerializer $learningGroupSerializer,
        private readonly LoadAiSettings $loadAiSettings,
        private readonly LoadPersonalSettings $personalSettings,
        private readonly LoadColorPaletteSettings $loadColorPaletteSettings,
        private readonly LoadLearningSupportSettings $loadLearningSupportSettings,
        private readonly LoadLanguageAdministration $loadLanguages,
        private readonly LoadReusableImageAssets $loadReusableImageAssets,
        private readonly LoadEditableWorldGraph $loadEditableWorldGraph,
        private readonly AdminWorldGraphSerializer $worldGraphSerializer,
        private readonly LoadEditableMap $loadEditableMap,
        private readonly EditableMapSerializer $editableMapSerializer,
        private readonly LoadEditableActivityGraph $loadEditableActivityGraph,
        private readonly AdminActivityGraphSerializer $activityGraphSerializer,
        private readonly LoadEditableTools $loadEditableTools,
        private readonly LoadEditableItems $loadEditableItems,
        private readonly LoadEditableSounds $loadEditableSounds,
        private readonly LoadLearningMapAccessGroups $loadMapAccessGroups,
        private readonly LoadLearningGroupOptions $loadLearningGroupOptions,
        private readonly AdminToolSerializer $adminToolSerializer,
        private readonly AdminItemSerializer $adminItemSerializer,
        private readonly LearningItemSerializer $itemSerializer,
        private readonly AdminSoundSerializer $soundSerializer,
        private readonly LearningMapEditAccessService $mapEditAccess,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(
        User $user,
        ?string $status,
        ?string $createdRegistrationToken,
        ?int $selectedMapId = null,
        ?int $selectedNodeId = null,
    ): array {
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
            'personalSettings' => [
                ...$this->personalSettings->handle($user, $status),
                'initialSection' => 'profile',
            ],
            'adminUsers' => $canManageUsers ? $this->adminUsers() : [],
            'assetsWorldObjects' => $this->assetsWorldObjects($accessCapabilities),
            'aiSettings' => $this->aiSettings($accessCapabilities),
            'registrationTokens' => $canManageUsers ? $this->registrationTokens() : [],
            'adminRoles' => $canManageRoles ? $this->accessRoles() : [],
            'permissionResources' => $this->permissionResources(),
            'colorPaletteSettings' => $this->colorPaletteSettings($user, $accessCapabilities),
            'languages' => $this->languages($accessCapabilities),
            'learningSupportSettings' => $this->loadLearningSupportSettings->handle($user),
            'platformInfoPages' => $canManagePresentation ? $this->platformInfoPages() : [],
            'publicPresentation' => $canManagePresentation ? PlatformPresentationSetting::current() : null,
            'createdRegistrationToken' => $createdRegistrationToken,
            'settingsNotifications' => $this->settingsNotifications($accessCapabilities),
            'worldGraph' => $this->worldGraph($user, $accessCapabilities),
            'selectedWorldMap' => $this->selectedWorldMap($user, $selectedMapId, $accessCapabilities),
            'selectedWorldNode' => $this->selectedWorldNode($user, $selectedNodeId, $accessCapabilities),
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
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array<string, mixed>|null
     */
    private function colorPaletteSettings(User $user, array $capabilities): ?array
    {
        $canReadColorPalette = collect([
            PermissionCatalog::PRESENTATION,
            PermissionCatalog::JOURNAL_SETTINGS,
            PermissionCatalog::WORLD_MAPS,
        ])->some(fn (string $resource): bool => $capabilities[$resource]['read'] ?? false);

        return $canReadColorPalette
            ? $this->loadColorPaletteSettings->handle($user)
            : null;
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return list<array{code: string, name: string, nativeName: string, isEnabled: bool, isDefault: bool}>
     */
    private function languages(array $capabilities): array
    {
        return ($capabilities[PermissionCatalog::LANGUAGES]['read'] ?? false)
            ? $this->loadLanguages->handle()
            : [];
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array<string, mixed>|null
     */
    private function aiSettings(array $capabilities): ?array
    {
        return ($capabilities[PermissionCatalog::AI]['read'] ?? false)
            ? $this->loadAiSettings->handle()
            : null;
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array{items: array<int, array<string, mixed>>, sounds: array<int, array<string, mixed>>, tools: array<int, array<string, mixed>>, visuals: array<int, array<string, mixed>>}
     */
    private function assetsWorldObjects(array $capabilities): array
    {
        $canReadAssets = $capabilities[PermissionCatalog::ASSETS]['read'] ?? false;
        $canReadSounds = $capabilities[PermissionCatalog::SOUNDS]['read'] ?? false;

        return [
            'items' => $canReadAssets
                ? $this->loadEditableItems
                    ->handle()
                    ->map(fn (LearningItem $item): array => $this->adminItemSerializer->serialize($item))
                    ->values()
                    ->all()
                : [],
            'sounds' => $canReadSounds
                ? $this->loadEditableSounds
                    ->handle()
                    ->map(fn (LearningSound $sound): array => $this->soundSerializer->serialize($sound))
                    ->values()
                    ->all()
                : [],
            'tools' => $canReadAssets
                ? $this->loadEditableTools
                    ->handle()
                    ->map(fn (LearningTool $tool): array => $this->adminToolSerializer->serialize($tool))
                    ->values()
                    ->all()
                : [],
            'visuals' => $canReadAssets
                ? $this->loadReusableImageAssets->handle()
                : [],
        ];
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
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array{pendingFeedbackRequests: int, pendingOrganizationIconReports: int, reportedOrganizations: array<int, array{id: int, name: string, iconUrl: string|null}>}
     */
    private function settingsNotifications(array $capabilities): array
    {
        $canSeeFeedbackRequests = $capabilities[PermissionCatalog::JOURNAL_FEEDBACK]['read'] ?? false;
        $canSeeOrganizationReports = $capabilities[PermissionCatalog::ORGANIZATION_MODERATION]['read'] ?? false;

        return [
            'pendingFeedbackRequests' => $canSeeFeedbackRequests
                ? LearnerJournalFeedbackRequest::query()
                    ->whereNull('responded_at')
                    ->count()
                : 0,
            'pendingOrganizationIconReports' => $canSeeOrganizationReports
                ? OrganizationIconReport::query()
                    ->where('status', OrganizationIconReport::STATUS_PENDING)
                    ->count()
                : 0,
            'reportedOrganizations' => $canSeeOrganizationReports
                ? OrganizationIconReport::query()
                    ->with('organization:id,name')
                    ->where('status', OrganizationIconReport::STATUS_PENDING)
                    ->latest()
                    ->limit(4)
                    ->get()
                    ->map(fn (OrganizationIconReport $report): array => [
                        'id' => $report->organization->id,
                        'name' => $report->organization->name,
                        'iconUrl' => $report->icon_url,
                    ])
                    ->values()
                    ->all()
                : [],
        ];
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array<string, mixed>|null
     */
    private function worldGraph(User $user, array $capabilities): ?array
    {
        $canReadWorldBuilder = collect([
            PermissionCatalog::WORLD_MAPS,
            PermissionCatalog::WORLD_NODES,
            PermissionCatalog::WORLD_ACTIVITIES,
            PermissionCatalog::WORLD_MAP_ACCESS,
        ])->some(fn (string $resource): bool => $capabilities[$resource]['read'] ?? false);

        if (! $canReadWorldBuilder) {
            return null;
        }

        try {
            return $this->worldGraphSerializer->serialize(
                $this->loadEditableWorldGraph->handle($user),
            );
        } catch (ModelNotFoundException) {
            return null;
        }
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array{accessGroups: array<int, array<string, mixed>>, canDeleteWorldMaps: bool, editableMap: array<string, mixed>, learningGroups: array<int, array<string, mixed>>, tools: array<int, array<string, mixed>>}|null
     */
    private function selectedWorldMap(User $user, ?int $mapId, array $capabilities): ?array
    {
        if (! $mapId || ! ($capabilities[PermissionCatalog::WORLD_MAPS]['update'] ?? false)) {
            return null;
        }

        $map = LearningMap::query()->find($mapId);

        if (! $map || ! $this->mapEditAccess->canEditMap($user, $map)) {
            return null;
        }

        return [
            'accessGroups' => $this->loadMapAccessGroups->handle(),
            'canDeleteWorldMaps' => $this->mapEditAccess->canDeleteMap($user, $map),
            'editableMap' => $this->editableMapSerializer->serialize(
                $this->loadEditableMap->handle($map),
            ),
            'learningGroups' => $this->loadLearningGroupOptions->handle(),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->adminToolSerializer->serialize($tool))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, array{read: bool, update: bool, delete: bool}>  $capabilities
     * @return array{activityGraph: array<string, mixed>, items: array<int, array<string, mixed>>, sounds: array<int, array<string, mixed>>, tools: array<int, array<string, mixed>>}|null
     */
    private function selectedWorldNode(User $user, ?int $nodeId, array $capabilities): ?array
    {
        if (! $nodeId || ! ($capabilities[PermissionCatalog::WORLD_ACTIVITIES]['update'] ?? false)) {
            return null;
        }

        $node = LearningNode::query()
            ->with('map')
            ->find($nodeId);

        if (! $node || ! $this->mapEditAccess->canEditActivitiesOnNode($user, $node)) {
            return null;
        }

        return [
            'activityGraph' => $this->activityGraphSerializer->serialize(
                $this->loadEditableActivityGraph->handle($node),
            ),
            'items' => $this->loadEditableItems
                ->handle()
                ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
                ->values()
                ->all(),
            'sounds' => $this->loadEditableSounds
                ->handle()
                ->map(fn (LearningSound $sound): array => $this->soundSerializer->serialize($sound))
                ->values()
                ->all(),
            'tools' => $this->loadEditableTools
                ->handle()
                ->map(fn (LearningTool $tool): array => $this->adminToolSerializer->serialize($tool))
                ->values()
                ->all(),
        ];
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
