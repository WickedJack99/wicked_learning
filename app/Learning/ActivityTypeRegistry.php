<?php

namespace App\Learning;

use App\Models\LearningActivity;

class ActivityTypeRegistry
{
    /**
     * Activity type definitions are intentionally small and data-shaped so new
     * activity renderers can be added without changing the graph editor.
     *
     * @return array<int, array<string, mixed>>
     */
    public function definitions(): array
    {
        return [
            [
                'key' => 'dialogue',
                'label' => 'Dialogue',
                'description' => 'NPC or narrator stages that continue after completion.',
                'inputs' => [$this->connector('in', 'In')],
                'outputs' => [$this->connector('completed', 'Completed')],
            ],
            [
                'key' => 'question',
                'label' => 'Question',
                'description' => 'A configurable question that can branch by answer outcome.',
                'inputs' => [$this->connector('in', 'In')],
                'outputs' => [
                    $this->connector('correct', 'Correct'),
                    $this->connector('incorrect', 'Incorrect'),
                    $this->connector('outcome', 'Outcome'),
                ],
            ],
            [
                'key' => 'reflection',
                'label' => 'Reflection',
                'description' => 'A learner-owned pause for useful notes or synthesis.',
                'inputs' => [$this->connector('in', 'In')],
                'outputs' => [$this->connector('completed', 'Completed')],
            ],
            [
                'key' => 'placeholder',
                'label' => 'Placeholder',
                'description' => 'A simple activity shell for content that will be designed later.',
                'inputs' => [$this->connector('in', 'In')],
                'outputs' => [$this->connector('completed', 'Completed')],
            ],
            [
                'key' => 'portal',
                'label' => 'Portal',
                'description' => 'A map or node travel activity. Entry portals must end their path.',
                'inputs' => [$this->connector('in', 'In')],
                'outputs' => [$this->connector('travel', 'Travel')],
                'portalModes' => [
                    ['key' => 'input', 'label' => 'Exit portal'],
                    ['key' => 'output', 'label' => 'Entry portal'],
                ],
            ],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function typeKeys(): array
    {
        return array_map(
            fn (array $definition): string => (string) $definition['key'],
            $this->definitions(),
        );
    }

    /**
     * @return array{inputs: array<int, array<string, string>>, outputs: array<int, array<string, string>>}
     */
    public function connectorsFor(LearningActivity $activity): array
    {
        if ($activity->type === 'portal') {
            return $this->portalConnectors($activity);
        }

        $definition = collect($this->definitions())
            ->first(fn (array $candidate): bool => $candidate['key'] === $activity->type);

        return [
            'inputs' => $definition['inputs'] ?? [$this->connector('in', 'In')],
            'outputs' => $definition['outputs'] ?? [$this->connector('completed', 'Completed')],
        ];
    }

    public function transitionTriggerForConnector(string $connector): string
    {
        return match ($connector) {
            'correct' => 'correct',
            'incorrect' => 'incorrect',
            'outcome' => 'outcome',
            'travel' => 'portal',
            default => 'completed',
        };
    }

    public function labelForOutput(LearningActivity $activity, string $connector): string
    {
        $match = collect($this->connectorsFor($activity)['outputs'])
            ->first(fn (array $output): bool => $output['id'] === $connector);

        return $match['label'] ?? ucfirst(str_replace('-', ' ', $connector));
    }

    /**
     * @return array{id: string, label: string}
     */
    private function connector(string $id, string $label): array
    {
        return ['id' => $id, 'label' => $label];
    }

    /**
     * @return array{inputs: array<int, array<string, string>>, outputs: array<int, array<string, string>>}
     */
    private function portalConnectors(LearningActivity $activity): array
    {
        $config = $this->activityConfig($activity);
        $portalMode = $config['portalMode'] ?? 'output';

        if ($portalMode === 'input') {
            return [
                'inputs' => [$this->connector('portal-entry', 'Exit')],
                'outputs' => [$this->connector('arrived', 'Arrived')],
            ];
        }

        return [
            'inputs' => [$this->connector('in', 'In')],
            'outputs' => [$this->connector('travel', 'Travel')],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function activityConfig(LearningActivity $activity): array
    {
        return is_array($activity->config) ? $activity->config : [];
    }
}
