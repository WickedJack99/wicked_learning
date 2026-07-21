<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_messages', function (Blueprint $table): void {
            $table->foreignId('hidden_by_user_id')
                ->nullable()
                ->after('user_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('hidden_at')->nullable()->after('hidden_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('organization_messages', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('hidden_by_user_id');
            $table->dropColumn('hidden_at');
        });
    }
};
