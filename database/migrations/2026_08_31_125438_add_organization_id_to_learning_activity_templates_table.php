<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_activity_templates', function (Blueprint $table): void {
            $table->foreignId('organization_id')
                ->nullable()
                ->after('created_by_user_id')
                ->constrained()
                ->nullOnDelete();
            $table->index(['organization_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::table('learning_activity_templates', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('organization_id');
        });
    }
};
