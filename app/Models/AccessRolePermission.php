<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['access_role_id', 'resource', 'level', 'scope'])]
class AccessRolePermission extends Model
{
    /**
     * @return BelongsTo<AccessRole, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(AccessRole::class, 'access_role_id');
    }
}
