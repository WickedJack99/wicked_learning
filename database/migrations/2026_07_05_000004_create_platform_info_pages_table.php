<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store editable public information pages such as About and legal pages.
     */
    public function up(): void
    {
        Schema::create('platform_info_pages', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->longText('markdown');
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_info_pages');
    }
};
