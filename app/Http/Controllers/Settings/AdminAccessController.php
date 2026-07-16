<?php

namespace App\Http\Controllers\Settings;

use App\Access\AccessLevel;
use App\Access\Actions\DeleteAccessRole;
use App\Access\Actions\SaveAccessRole;
use App\Access\PermissionCatalog;
use App\Http\Controllers\Controller;
use App\Models\AccessRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAccessController extends Controller
{
    public function storeRole(Request $request, SaveAccessRole $saveRole): RedirectResponse
    {
        $saveRole->handle($request->validate($this->rules()));

        return redirect()->route('settings.index', ['panel' => 'admin-access']);
    }

    public function updateRole(Request $request, AccessRole $role, SaveAccessRole $saveRole): RedirectResponse
    {
        $saveRole->handle($request->validate($this->rules($role)), $role);

        return redirect()->route('settings.index', ['panel' => 'admin-access']);
    }

    public function destroyRole(AccessRole $role, DeleteAccessRole $deleteRole): RedirectResponse
    {
        $deleteRole->handle($role);

        return redirect()->route('settings.index', ['panel' => 'admin-access']);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?AccessRole $role = null): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'level' => ['required', 'integer', 'min:1', 'max:100'],
            'permissions' => ['required', 'array'],
        ];

        if ($role === null) {
            $rules['slug'] = [
                'required',
                'string',
                'max:80',
                'alpha_dash',
                Rule::unique('access_roles', 'slug'),
            ];
        }

        foreach (PermissionCatalog::resourceKeys() as $resource) {
            $rules["permissions.{$resource}"] = [
                // New permission areas are introduced over time. Existing
                // clients may not submit their key yet; SaveAccessRole gives
                // omitted resources the conservative "none" level.
                'sometimes',
                'string',
                Rule::in(AccessLevel::values()),
            ];
        }

        return $rules;
    }
}
