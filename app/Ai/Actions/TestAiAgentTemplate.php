<?php

namespace App\Ai\Actions;

use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class TestAiAgentTemplate
{
    /**
     * @return array{
     *     text: string,
     *     model: string,
     *     provider: string,
     *     responseId: string|null,
     *     usage: array{inputTokens: int|null, outputTokens: int|null, totalTokens: int|null}
     * }
     */
    public function handle(AiAgentTemplate $template, string $prompt): array
    {
        $template->loadMissing('providerCredential');

        $credential = $template->providerCredential;

        if (! $credential) {
            $this->fail('Choose a provider key before testing this agent.');
        }

        if (! $credential->enabled) {
            $this->fail('Enable the selected provider key before testing this agent.');
        }

        $apiKey = trim((string) $credential->api_key);

        if ($apiKey === '') {
            $this->fail('Save an API key on the selected provider before testing this agent.');
        }

        $model = trim((string) $template->model);

        if ($model === '') {
            $this->fail('Choose a model before testing this agent.');
        }

        $response = Http::withHeaders($this->headers($credential, $apiKey))
            ->acceptJson()
            ->timeout(60)
            ->post($this->responsesEndpoint($credential), $this->payload($template, $model, $prompt));

        if (! $response->successful()) {
            $this->fail($this->providerErrorMessage($response));
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
            'usage' => [
                'inputTokens' => $this->integerValue($data['usage']['input_tokens'] ?? null),
                'outputTokens' => $this->integerValue($data['usage']['output_tokens'] ?? null),
                'totalTokens' => $this->integerValue($data['usage']['total_tokens'] ?? null),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function headers(AiProviderCredential $credential, string $apiKey): array
    {
        $headers = [
            'Authorization' => "Bearer {$apiKey}",
        ];

        if (filled($credential->organization)) {
            $headers['OpenAI-Organization'] = (string) $credential->organization;
        }

        return $headers;
    }

    private function responsesEndpoint(AiProviderCredential $credential): string
    {
        if ($credential->provider === 'openai') {
            $baseUrl = trim((string) $credential->base_url) ?: 'https://api.openai.com/v1';

            return rtrim($baseUrl, '/').'/responses';
        }

        if ($credential->provider === 'compatible') {
            $baseUrl = trim((string) $credential->base_url);

            if ($baseUrl === '') {
                $this->fail('OpenAI-compatible providers need a base URL before testing.');
            }

            return rtrim($baseUrl, '/').'/responses';
        }

        $this->fail('This test runner currently supports OpenAI and OpenAI-compatible providers.');
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(AiAgentTemplate $template, string $model, string $prompt): array
    {
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

        $payload['temperature'] = $template->temperature;

        return $payload;
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

    /**
     * @param  array<string, mixed>  $data
     */
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

    private function providerErrorMessage(ClientResponse $response): string
    {
        $message = $response->json('error.message');

        if (! is_string($message) || trim($message) === '') {
            $message = $response->body();
        }

        return sprintf(
            'AI provider returned HTTP %s: %s',
            $response->status(),
            Str::limit(trim($message), 500),
        );
    }

    private function integerValue(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function fail(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => [
                'prompt' => [$message],
            ],
        ], 422));
    }
}
