<?php

namespace App\Access\Actions;

use App\Models\AccessRole;
use Illuminate\Validation\ValidationException;

class DeleteAccessRole
{
    public function handle(AccessRole $role): void
    {
        if ($role->is_system) {
            throw ValidationException::withMessages([
                'role' => 'Default roles must remain available.',
            ]);
        }

        $role->delete();
    }
}
