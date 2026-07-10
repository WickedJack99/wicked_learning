<?php

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_roles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('level')->default(10);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('access_role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('access_role_id')->constrained('access_roles')->cascadeOnDelete();
            $table->string('resource');
            $table->string('level', 16)->default(AccessLevel::NONE);
            $table->timestamps();
            $table->unique(['access_role_id', 'resource']);
        });

        Schema::create('access_role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('access_role_id')->constrained('access_roles')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['access_role_id', 'user_id']);
        });

        $this->seedDefaultRoles();
        $this->syncExistingUsers();
    }

    public function down(): void
    {
        Schema::dropIfExists('access_role_user');
        Schema::dropIfExists('access_role_permissions');
        Schema::dropIfExists('access_roles');
    }

    private function seedDefaultRoles(): void
    {
        $userRoleId = DB::table('access_roles')->insertGetId([
            'slug' => User::ROLE_USER,
            'name' => 'User',
            'description' => 'Default learner role.',
            'level' => 10,
            'is_system' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $adminRoleId = DB::table('access_roles')->insertGetId([
            'slug' => User::ROLE_ADMIN,
            'name' => 'Admin',
            'description' => 'Default administrative role with full platform access.',
            'level' => 100,
            'is_system' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (PermissionCatalog::resourceKeys() as $resource) {
            DB::table('access_role_permissions')->insert([
                [
                    'access_role_id' => $userRoleId,
                    'resource' => $resource,
                    'level' => AccessLevel::NONE,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'access_role_id' => $adminRoleId,
                    'resource' => $resource,
                    'level' => AccessLevel::DELETE,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }

    private function syncExistingUsers(): void
    {
        DB::table('users')
            ->select(['id', 'role', 'roles'])
            ->orderBy('id')
            ->eachById(function (object $user): void {
                foreach ($this->roleSlugsForUser($user) as $slug) {
                    $roleId = $this->roleIdForSlug($slug);

                    DB::table('access_role_user')->updateOrInsert([
                        'access_role_id' => $roleId,
                        'user_id' => $user->id,
                    ], [
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    /**
     * @return list<string>
     */
    private function roleSlugsForUser(object $user): array
    {
        $roles = json_decode($user->roles ?? '[]', true);

        if (! is_array($roles)) {
            $roles = [];
        }

        $roles[] = $user->role ?: User::ROLE_USER;
        $normalized = array_values(array_unique(array_filter($roles, 'is_string')));

        return $normalized === [] ? [User::ROLE_USER] : $normalized;
    }

    private function roleIdForSlug(string $slug): int
    {
        $existingId = DB::table('access_roles')->where('slug', $slug)->value('id');

        if ($existingId) {
            return (int) $existingId;
        }

        return DB::table('access_roles')->insertGetId([
            'slug' => $slug,
            'name' => Str::headline($slug),
            'description' => null,
            'level' => 10,
            'is_system' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
