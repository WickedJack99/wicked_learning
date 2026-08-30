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
        Schema::create('learning_source_record_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_source_record_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 160);
            $table->string('url', 2048);
            $table->string('publisher', 160)->nullable();
            $table->date('published_at')->nullable();
            $table->string('rights', 240)->nullable();
            $table->string('anchor', 240)->nullable();
            $table->string('excerpt', 800)->nullable();
            $table->timestamps();

            $table->index(['learning_source_record_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_source_record_versions');
    }
};
