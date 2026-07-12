<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->json('access_roles')->nullable()->after('grid_config');
        });

        DB::table('learning_maps')->update([
            'access_roles' => json_encode([User::ROLE_USER, User::ROLE_ADMIN]),
        ]);
    }

    public function down(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->dropColumn('access_roles');
        });
    }
};
