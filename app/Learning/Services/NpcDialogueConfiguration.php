<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;

class NpcDialogueConfiguration
{
    /**
     * @var array<int, string>
     */
    private array $colors = [
        '#0ea5e9',
        '#22c55e',
        '#f97316',
        '#a855f7',
        '#ef4444',
        '#14b8a6',
    ];

    public function scaffoldDefaultEnd(LearningActivity $activity): void
    {
        if ($activity->type !== 'npc_dialogue' || $activity->npcDialogueNodes()->where('type', 'end')->exists()) {
            return;
        }

        $activity->npcDialogueNodes()->create([
            'type' => 'end',
            'title' => 'End A',
            'body' => null,
            'config' => $this->endConfig(0),
            'sort_order' => 10,
            'graph_position_x' => 520,
            'graph_position_y' => 80,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function configFor(string $type, array $data, array $existing = [], ?int $endIndex = null): array
    {
        $defaults = match ($type) {
            'answer' => $this->answerConfig(),
            'end' => $this->endConfig($endIndex ?? 0),
            default => $this->interactionConfig(),
        };

        return [
            ...$defaults,
            ...$existing,
            ...$this->configArray($data),
        ];
    }

    /**
     * @return array{id: string, label: string, color: string, symbol: string}
     */
    public function connectorFor(NpcDialogueNode $node, int $index): array
    {
        $config = is_array($node->config) ? $node->config : [];
        $symbol = (string) ($config['connectorSymbol'] ?? $this->symbolFor($index));

        return [
            'id' => $this->connectorId($node),
            'label' => trim($symbol.' '.($node->title ?: 'End')),
            'color' => (string) ($config['connectorColor'] ?? $this->colors[$index % count($this->colors)]),
            'symbol' => $symbol,
        ];
    }

    public function connectorId(NpcDialogueNode $node): string
    {
        return 'dialogue-end-'.$node->id;
    }

    /**
     * @return array<string, mixed>
     */
    private function endConfig(int $index): array
    {
        return [
            'connectorColor' => $this->colors[$index % count($this->colors)],
            'connectorSymbol' => $this->symbolFor($index),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function interactionConfig(): array
    {
        return [
            'backgroundDark' => '',
            'backgroundLight' => '',
            'npcImageDark' => '',
            'npcImageLight' => '',
            'slideDirection' => 'left',
            'slideDurationSeconds' => 0.6,
            'fadeDurationSeconds' => 0.4,
            'npcX' => 50,
            'npcY' => 50,
            'toolId' => null,
            'questionOutputCount' => 2,
            'typingSpeed' => 28,
            'bubbleColorDark' => '#0f172a',
            'bubbleBorderColorDark' => '#2dd4bf',
            'bubbleOpacityDark' => 92,
            'bubbleColorLight' => '#ffffff',
            'bubbleBorderColorLight' => '#0891b2',
            'bubbleOpacityLight' => 94,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function answerConfig(): array
    {
        return [
            'answerLabel' => '',
            'isCorrect' => false,
        ];
    }

    private function symbolFor(int $index): string
    {
        return chr(65 + ($index % 26));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function configArray(array $data): array
    {
        return is_array($data['config'] ?? null) ? $data['config'] : [];
    }
}
