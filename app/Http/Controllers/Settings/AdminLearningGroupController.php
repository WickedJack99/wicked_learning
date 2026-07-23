<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Http\Controllers\Controller;
use App\Learning\Actions\SaveLearningGroup;
use App\Learning\Actions\SyncLearningGroupMembers;
use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminLearningGroupController extends Controller
{
    public function index(): RedirectResponse
    {
        return $this->redirectToGroupsSection();
    }

    public function store(Request $request, SaveLearningGroup $save): RedirectResponse
    {
        $save->handle($request->validate($this->rules()), creator: $request->user());

        return $this->redirectToGroupsSection();
    }

    public function update(
        Request $request,
        LearningGroup $group,
        SaveLearningGroup $save,
    ): RedirectResponse {
        $this->authorizeGroupUpdate($request, $group);

        $save->handle($request->validate($this->rules($group)), $group);

        return $this->redirectToGroupsSection();
    }

    public function updateMembers(
        Request $request,
        LearningGroup $group,
        SyncLearningGroupMembers $syncMembers,
    ): RedirectResponse {
        $this->authorizeGroupMembershipUpdate($request, $group);

        $data = $request->validate([
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $syncMembers->handle($group, $data['user_ids'] ?? []);

        return $this->redirectToGroupsSection();
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?LearningGroup $group = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'alpha_dash',
                'max:140',
                Rule::unique('learning_groups', 'slug')->ignore($group),
            ],
            'description' => ['nullable', 'string', 'max:4000'],
            'study_topic' => ['nullable', 'string', 'max:180'],
        ];
    }

    private function authorizeGroupUpdate(Request $request, LearningGroup $group): void
    {
        $user = $request->user();

        abort_unless($user && $this->hasGroupScope($user, $group, PermissionCatalog::GROUPS), 403);
    }

    private function authorizeGroupMembershipUpdate(Request $request, LearningGroup $group): void
    {
        $user = $request->user();

        abort_unless($user && $this->hasGroupScope($user, $group, PermissionCatalog::GROUP_MEMBERS), 403);
    }

    private function hasGroupScope(User $user, LearningGroup $group, string $resource): bool
    {
        if (! $user->hasAccess($resource, AccessLevel::UPDATE)) {
            return false;
        }

        $scope = $user->accessScopeFor($resource, AccessLevel::UPDATE);

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

    private function redirectToGroupsSection(): RedirectResponse
    {
        return to_route('settings.index', [
            'panel' => 'admin-access',
            'access' => 'groups',
        ]);
    }
}
