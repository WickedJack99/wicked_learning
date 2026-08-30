<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('learner_reflections', function (Blueprint $table) {
            $table->string('response_type', 24)->default('reflection')->after('reflection');
            $table->longText('response_context')->nullable()->after('response_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_reflections', function (Blueprint $table) {
            $table->dropColumn(['response_type', 'response_context']);
        });
    }
};
