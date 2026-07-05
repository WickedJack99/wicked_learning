<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Allow accounts and registration tokens to hold more than one role.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('roles')->nullable()->after('role');
        });

        Schema::table('registration_tokens', function (Blueprint $table) {
            $table->json('roles')->nullable()->after('role');
        });

        DB::table('users')
            ->whereNull('roles')
            ->orderBy('id')
            ->eachById(function (object $user): void {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['roles' => json_encode([$user->role])]);
            });

        DB::table('registration_tokens')
            ->whereNull('roles')
            ->orderBy('id')
            ->eachById(function (object $token): void {
                DB::table('registration_tokens')
                    ->where('id', $token->id)
                    ->update(['roles' => json_encode([$token->role])]);
            });
    }

    public function down(): void
    {
        Schema::table('registration_tokens', function (Blueprint $table) {
            $table->dropColumn('roles');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('roles');
        });
    }
};
