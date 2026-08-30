<?php

namespace App\Learning\Validation;

use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LearningCompanionDialogueGraphValidator
{
    public const VERSION = 1;

    /** @var list<string> */
    private const NAVIGATION_ACTIONS = [
        'current-map',
        'learning-desk',
        'topics',
        'continue-exploring',
    ];

    /** @var list<string> */
    private const AI_CAPABILITIES = [
        'current-context',
        'navigation-alternatives',
        'route-context',
        'nearby-places',
        'topic-context',
        'revisit-options',
    ];

    /** @return array<string, mixed>|null */
    public function validate(mixed $graph): ?array
    {
        if ($graph === null || $graph === []) {
            return null;
        }

        $validator = Validator::make(is_array($graph) ? $graph : [], [
            'version' => ['required', 'integer', Rule::in([self::VERSION])],
            'start' => ['required', 'string', 'max:80'],
            'nodes' => ['required', 'array', 'min:1', 'max:24'],
            'nodes.*.id' => ['required', 'string', 'max:80'],
            'nodes.*.type' => ['required', Rule::in(['message', 'choice', 'ai', 'end'])],
            'nodes.*.title' => ['nullable', 'string', 'max:120'],
            'nodes.*.message' => ['nullable', 'string', 'max:2000'],
            'nodes.*.prompt' => ['nullable', 'string', 'max:1000'],
            'nodes.*.instruction' => ['nullable', 'string', 'max:1000'],
            'nodes.*.response_mode' => ['nullable', Rule::in(['message', 'choice'])],
            'nodes.*.capabilities' => ['nullable', 'array', 'max:3'],
            'nodes.*.capabilities.*' => ['string', Rule::in(self::AI_CAPABILITIES)],
            'nodes.*.position' => ['nullable', 'array'],
            'nodes.*.position.x' => ['required_with:nodes.*.position', 'integer', 'between:-10000,10000'],
            'nodes.*.position.y' => ['required_with:nodes.*.position', 'integer', 'between:-10000,10000'],
            'nodes.*.next' => ['nullable', 'string', 'max:80'],
            'nodes.*.choices' => ['nullable', 'array', 'max:4'],
            'nodes.*.choices.*.key' => ['required', 'string', 'max:80'],
            'nodes.*.choices.*.label' => ['required', 'string', 'max:240'],
            'nodes.*.choices.*.next' => ['nullable', 'string', 'max:80'],
            'nodes.*.choices.*.action' => ['nullable', Rule::in(self::NAVIGATION_ACTIONS)],
        ]);

        if ($validator->fails()) {
            $this->fail($validator);
        }

        /** @var array{version: int, start: string, nodes: list<array<string, mixed>>} $validated */
        $validated = $validator->validated();
        $nodes = $validated['nodes'];
        $nodeIds = array_column($nodes, 'id');

        if (count($nodeIds) !== count(array_unique($nodeIds))) {
            $this->failMessage('Dialogue node ids must be unique.');
        }

        if (! in_array($validated['start'], $nodeIds, true)) {
            $this->failMessage('The dialogue start node must exist in the graph.');
        }

        foreach ($nodes as $node) {
            $type = $node['type'];
            $choices = is_array($node['choices'] ?? null) ? $node['choices'] : [];

            if (in_array($type, ['message', 'end'], true) && blank($node['message'] ?? null)) {
                $this->failMessage("The {$type} dialogue node must contain a message.");
            }

            if ($type === 'choice' && (blank($node['prompt'] ?? null) || $choices === [])) {
                $this->failMessage('A choice dialogue node must contain a prompt and choices.');
            }

            if ($type === 'ai' && blank($node['instruction'] ?? null)) {
                $this->failMessage('An AI dialogue node must contain an instruction.');
            }

            foreach ($this->targets($node) as $target) {
                if (! in_array($target, $nodeIds, true)) {
                    $this->failMessage("Dialogue target [{$target}] does not exist.");
                }
            }

            foreach ($choices as $choice) {
                if (($choice['next'] ?? null) === null && ($choice['action'] ?? null) === null) {
                    $this->failMessage('A terminal dialogue choice must use an allowlisted navigation action.');
                }
            }
        }

        return $validated;
    }

    /** @return list<string> */
    public function navigationActions(): array
    {
        return self::NAVIGATION_ACTIONS;
    }

    /** @return list<string> */
    public function aiCapabilities(): array
    {
        return self::AI_CAPABILITIES;
    }

    /** @param array<string, mixed> $node @return list<string> */
    private function targets(array $node): array
    {
        $targets = [];
        if (is_string($node['next'] ?? null)) {
            $targets[] = $node['next'];
        }

        foreach (is_array($node['choices'] ?? null) ? $node['choices'] : [] as $choice) {
            if (is_string($choice['next'] ?? null)) {
                $targets[] = $choice['next'];
            }
        }

        return $targets;
    }

    private function fail(ValidatorContract $validator): never
    {
        throw ValidationException::withMessages([
            'dialogue_graph' => $validator->errors()->first(),
        ]);
    }

    private function failMessage(string $message): never
    {
        throw ValidationException::withMessages(['dialogue_graph' => $message]);
    }
}
