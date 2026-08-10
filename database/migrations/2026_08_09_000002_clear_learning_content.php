<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Remove the prototype learning content while keeping accounts, roles and
     * the reusable media/tool pool intact.
     */
    public function up(): void
    {
        // Keep the world shell so the World Builder can create the first new
        // map immediately. Maps cascade their nodes and activities.
        DB::table('learning_maps')->delete();
    }

    public function down(): void
    {
        // Prototype content is intentionally not recreated on rollback.
    }
};
