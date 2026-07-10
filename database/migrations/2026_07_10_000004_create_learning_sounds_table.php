<?php

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_sounds', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon')->default('music');
            $table->string('url', 2048);
            $table->decimal('volume', 5, 2)->default(70);
            $table->decimal('play_seconds', 8, 2)->nullable();
            $table->boolean('loop')->default(false);
            $table->timestamps();
        });

        $this->seedPermissionRows();
        $this->seedExampleSounds();
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_sounds');
    }

    private function seedPermissionRows(): void
    {
        if (! Schema::hasTable('access_roles')) {
            return;
        }

        DB::table('access_roles')
            ->select(['id', 'slug'])
            ->orderBy('id')
            ->eachById(function (object $role): void {
                DB::table('access_role_permissions')->updateOrInsert([
                    'access_role_id' => $role->id,
                    'resource' => PermissionCatalog::SOUNDS,
                ], [
                    'level' => $role->slug === 'admin' ? AccessLevel::DELETE : AccessLevel::NONE,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    private function seedExampleSounds(): void
    {
        DB::table('learning_sounds')->insert([
            [
                'name' => 'Soft Chime',
                'slug' => 'soft-chime',
                'icon' => 'ui',
                'url' => '/sounds/soft-chime.wav',
                'volume' => 65,
                'play_seconds' => null,
                'loop' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Quiet Pulse',
                'slug' => 'quiet-pulse',
                'icon' => 'ambience',
                'url' => '/sounds/quiet-pulse.wav',
                'volume' => 35,
                'play_seconds' => null,
                'loop' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
};
