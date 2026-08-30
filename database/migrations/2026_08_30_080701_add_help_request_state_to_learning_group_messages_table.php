<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_group_messages', function (Blueprint $table): void {
            $table->boolean('is_help_request')->default(false)->after('body');
            $table->timestamp('resolved_at')->nullable()->after('is_help_request');
            $table->foreignId('resolved_by_user_id')
                ->nullable()
                ->after('resolved_at')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('learning_group_messages', function (Blueprint $table): void {
            $table->dropForeign(['resolved_by_user_id']);
            $table->dropColumn([
                'is_help_request',
                'resolved_at',
                'resolved_by_user_id',
            ]);
        });
    }
};
