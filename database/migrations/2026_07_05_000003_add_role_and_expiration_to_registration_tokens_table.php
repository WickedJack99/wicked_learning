<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Define which role a token grants and when it stops being usable.
     */
    public function up(): void
    {
        Schema::table('registration_tokens', function (Blueprint $table) {
            $table->string('role')->default(User::ROLE_USER)->after('token_hash');
            $table->timestamp('expires_at')->nullable()->after('used_at');
        });
    }

    public function down(): void
    {
        Schema::table('registration_tokens', function (Blueprint $table) {
            $table->dropColumn(['role', 'expires_at']);
        });
    }
};
