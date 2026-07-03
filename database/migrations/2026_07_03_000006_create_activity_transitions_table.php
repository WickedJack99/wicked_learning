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
        Schema::create('activity_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->foreignId('to_activity_id')->nullable()->constrained('learning_activities')->nullOnDelete();
            $table->string('trigger')->default('completed');
            $table->string('trigger_value')->nullable();
            $table->string('label')->nullable();
            $table->json('rules')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_transitions');
    }
};
