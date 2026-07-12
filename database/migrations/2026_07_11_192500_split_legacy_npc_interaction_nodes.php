<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('npc_dialogue_nodes')
            ->where('type', 'npc_interaction')
            ->orderBy('id')
            ->get()
            ->each(function (object $node): void {
                $row = (array) $node;
                $config = $this->decodeConfig($row['config'] ?? null);
                $type = ($config['interactionMode'] ?? null) === 'question'
                    ? 'npc_question'
                    : 'npc_monologue';

                $config['interactionMode'] = $type === 'npc_question'
                    ? 'question'
                    : 'monologue';

                DB::table('npc_dialogue_nodes')
                    ->where('id', (int) $row['id'])
                    ->update([
                        'config' => json_encode($config),
                        'type' => $type,
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('npc_dialogue_nodes')
            ->whereIn('type', ['npc_monologue', 'npc_question'])
            ->update([
                'type' => 'npc_interaction',
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeConfig(mixed $config): array
    {
        if (is_array($config)) {
            return $config;
        }

        if (! is_string($config)) {
            return [];
        }

        $decoded = json_decode($config, true);

        return is_array($decoded) ? $decoded : [];
    }
};
