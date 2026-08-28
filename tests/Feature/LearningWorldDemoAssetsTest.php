<?php

use App\Models\NpcDialogueNode;
use Database\Seeders\DemoLearningWorldSeeder;

test('seeded npc dialogue backgrounds are available to playback', function () {
    $this->seed(DemoLearningWorldSeeder::class);

    NpcDialogueNode::query()
        ->whereIn('type', ['npc_monologue', 'npc_question'])
        ->each(function (NpcDialogueNode $node): void {
            $config = $node->config;

            expect(file_exists(public_path(ltrim($config['backgroundDark'], '/'))))
                ->toBeTrue()
                ->and(file_exists(public_path(ltrim($config['backgroundLight'], '/'))))
                ->toBeTrue();
        });
});
