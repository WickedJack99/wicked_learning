<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reusable_media_metadata', function (Blueprint $table): void {
            $table->id();
            $table->string('url', 2048)->unique();
            $table->string('category', 80)->nullable();
            $table->json('tags')->nullable();
            $table->boolean('has_transparency')->nullable();
            $table->boolean('is_animated')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reusable_media_metadata');
    }
};
