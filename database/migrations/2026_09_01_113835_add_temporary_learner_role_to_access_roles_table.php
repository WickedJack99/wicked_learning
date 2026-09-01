<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the least-privileged role used by temporary demonstration accounts.
     */
    public function up(): void
    {
        if (! Schema::hasTable('access_roles') || DB::table('access_roles')->where('slug', User::ROLE_TEMPORARY)->exists()) {
            return;
        }

        $roleId = DB::table('access_roles')->insertGetId([
            'slug' => User::ROLE_TEMPORARY,
            'name' => 'Temporary learner',
            'description' => 'Default role for short-lived demonstration accounts.',
            'level' => 1,
            'is_system' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $roleId = DB::table('access_roles')->where('slug', User::ROLE_TEMPORARY)->value('id');

        if (! $roleId) {
            return;
        }

        DB::table('access_role_user')->where('access_role_id', $roleId)->delete();
        DB::table('access_role_permissions')->where('access_role_id', $roleId)->delete();
        DB::table('access_roles')->where('id', $roleId)->delete();
    }
};
