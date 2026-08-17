<?php

namespace App\Ai\Actions;

use App\Models\AiAgentTemplate;

class TestAiAgentTemplate
{
    public function __construct(private readonly RunAiAgentTemplate $runner) {}

    /**
     * @return array{
     *     text: string,
     *     model: string,
     *     provider: string,
     *     responseId: string|null,
     *     requestId: string|null,
     *     usage: array{inputTokens: int|null, outputTokens: int|null, totalTokens: int|null}
     * }
     */
    public function handle(AiAgentTemplate $template, string $prompt): array
    {
        return $this->runner->handle($template, $prompt);
    }
}
