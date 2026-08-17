<?php

namespace App\Ai\Actions;

use App\Ai\Exceptions\AiProviderRequestException;
use App\Ai\Support\AiModelCapabilities;
use App\Ai\Support\AiProviderError;
use App\Ai\Transport\AiResponsesClient;
use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;
use Illuminate\Http\Exceptions\HttpResponseException;

class RunAiAgentTemplate
{
    public function __construct(
        private readonly AiResponsesClient $responsesClient,
        private readonly AiModelCapabilities $modelCapabilities,
    ) {}

    /**
     * @param  array<string, mixed>|null  $textFormat
     * @return array{
     *     text: string,
     *     model: string,
     *     provider: string,
     *     responseId: string|null,
     *     requestId: string|null,
     *     usage: array{inputTokens: int|null, outputTokens: int|null, totalTokens: int|null}
     * }
     */
    public function handle(
        AiAgentTemplate $template,
        string $prompt,
        ?array $textFormat = null,
    ): array {
        $template->loadMissing('providerCredential');
        $credential = $template->providerCredential;

        if (! $credential) {
            $this->fail('Choose a provider key before running this agent.');
        }

        if (! $credential->enabled) {
            $this->fail('Enable the selected provider key before running this agent.');
        }

        if (trim((string) $credential->api_key) === '') {
            $this->fail('Save an API key on the selected provider before testing this agent.');
        }

        $model = trim((string) $template->model);

        if ($model === '') {
            $this->fail('Choose a model before running this agent.');
        }

        $this->validateProvider($credential);

        try {
            $response = $this->responsesClient->create(
                $credential,
                $this->payload($template, $credential, $model, $prompt, $textFormat),
            );
        } catch (AiProviderRequestException $exception) {
            $this->failProvider($exception->providerError);
        }

        $data = $response->json();

        if (! is_array($data)) {
            $this->fail('The AI provider returned an unreadable response.');
        }

        return [
            'text' => $this->extractOutputText($data),
            'model' => $model,
            'provider' => $credential->provider,
            'responseId' => isset($data['id']) && is_string($data['id']) ? $data['id'] : null,
            'requestId' => $response->header('x-request-id'),
            'usage' => [
                'inputTokens' => $this->integerValue($data['usage']['input_tokens'] ?? null),
                'outputTokens' => $this->integerValue($data['usage']['output_tokens'] ?? null),
                'totalTokens' => $this->integerValue($data['usage']['total_tokens'] ?? null),
            ],
        ];
    }

    private function validateProvider(AiProviderCredential $credential): void
    {
        if (! in_array($credential->provider, ['openai', 'compatible'], true)) {
            $this->fail('This runner currently supports OpenAI and OpenAI-compatible providers.');
        }

        if ($credential->provider === 'compatible' && blank($credential->base_url)) {
            $this->fail('OpenAI-compatible providers need a base URL before they can run.');
        }
    }

    /**
     * @param  array<string, mixed>|null  $textFormat
     * @return array<string, mixed>
     */
    private function payload(
        AiAgentTemplate $template,
        AiProviderCredential $credential,
        string $model,
        string $prompt,
        ?array $textFormat,
    ): array {
        $payload = [
            'model' => $model,
            'input' => $prompt,
        ];

        $instructions = $this->instructions($template);

        if ($instructions !== '') {
            $payload['instructions'] = $instructions;
        }

        if ($template->max_output_tokens !== null) {
            $payload['max_output_tokens'] = $template->max_output_tokens;
        }

        if ($textFormat !== null) {
            $payload['text'] = ['format' => $textFormat];
        }

        return array_merge(
            $payload,
            $this->modelCapabilities->requestOptions($credential, $template, $model),
        );
    }

    private function instructions(AiAgentTemplate $template): string
    {
        $parts = [];

        foreach ([$template->system_prompt, $template->task_prompt] as $promptPart) {
            $value = trim((string) $promptPart);

            if ($value !== '') {
                $parts[] = $value;
            }
        }

        return implode("\n\n", $parts);
    }

    /** @param array<string, mixed> $data */
    private function extractOutputText(array $data): string
    {
        if (isset($data['output_text']) && is_string($data['output_text'])) {
            return trim($data['output_text']);
        }

        $segments = [];

        foreach (($data['output'] ?? []) as $output) {
            if (! is_array($output)) {
                continue;
            }

            foreach (($output['content'] ?? []) as $content) {
                if (! is_array($content)) {
                    continue;
                }

                $text = $content['text'] ?? $content['value'] ?? null;

                if (is_string($text) && trim($text) !== '') {
                    $segments[] = trim($text);
                }
            }
        }

        return implode("\n\n", $segments);
    }

    private function integerValue(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function fail(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['prompt' => [$message]],
        ], 422));
    }

    private function failProvider(AiProviderError $error): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $error->message,
            'errors' => ['prompt' => [$error->message]],
            'aiError' => $error->publicDetails(),
        ], $error->applicationStatus()));
    }
}
