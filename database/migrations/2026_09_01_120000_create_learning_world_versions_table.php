<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_world_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_world_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['learning_world_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_world_versions');
    }
};
