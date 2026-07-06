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
        Schema::table('learning_activity_starts', function (Blueprint $table) {
            $table->string('button_color_dark', 32)->nullable()->after('image_light');
            $table->string('button_border_color_dark', 32)->nullable()->after('button_color_dark');
            $table->string('button_color_light', 32)->nullable()->after('button_border_color_dark');
            $table->string('button_border_color_light', 32)->nullable()->after('button_color_light');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learning_activity_starts', function (Blueprint $table) {
            $table->dropColumn([
                'button_color_dark',
                'button_border_color_dark',
                'button_color_light',
                'button_border_color_light',
            ]);
        });
    }
};
