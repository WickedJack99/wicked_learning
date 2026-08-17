<?php

namespace App\Ai\Transport;

use App\Ai\Exceptions\AiProviderRequestException;
use App\Ai\Support\AiProviderError;
use App\Models\AiProviderCredential;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AiResponsesClient
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(AiProviderCredential $credential, array $payload): Response
    {
        $clientRequestId = (string) Str::uuid();
        $model = is_string($payload['model'] ?? null) ? $payload['model'] : '';

        try {
            $response = Http::withHeaders($this->headers($credential, $clientRequestId))
                ->acceptJson()
                ->connectTimeout((float) config('ai.provider_http.connect_timeout_seconds', 10))
                ->timeout((float) config('ai.provider_http.timeout_seconds', 60))
                ->retry(
                    (int) config('ai.provider_http.attempts', 3),
                    fn (int $attempt, Throwable $exception): int => $this->retryDelay($attempt, $exception),
                    fn (Throwable $exception): bool => $this->shouldRetry($exception),
                    throw: false,
                )
                ->post($this->responsesEndpoint($credential), $payload);
        } catch (ConnectionException $exception) {
            $this->throwProviderError(
                AiProviderError::connection($clientRequestId),
                $credential,
                $model,
                $exception,
            );
        }

        if (! $response->successful()) {
            $this->throwProviderError(
                AiProviderError::fromResponse($response, $clientRequestId),
                $credential,
                $model,
            );
        }

        return $response;
    }

    /**
     * @return array<string, string>
     */
    private function headers(AiProviderCredential $credential, string $clientRequestId): array
    {
        $headers = [
            'Authorization' => 'Bearer '.trim((string) $credential->api_key),
            'X-Client-Request-Id' => $clientRequestId,
        ];

        if (filled($credential->organization)) {
            $headers['OpenAI-Organization'] = (string) $credential->organization;
        }

        return $headers;
    }

    private function responsesEndpoint(AiProviderCredential $credential): string
    {
        $baseUrl = trim((string) $credential->base_url);

        if ($credential->provider === 'openai') {
            $baseUrl = $baseUrl !== '' ? $baseUrl : 'https://api.openai.com/v1';
        }

        return rtrim($baseUrl, '/').'/responses';
    }

    private function shouldRetry(Throwable $exception): bool
    {
        if ($exception instanceof ConnectionException) {
            return true;
        }

        return $exception instanceof RequestException
            && $exception->response !== null
            && AiProviderError::responseIsRetryable($exception->response);
    }

    private function retryDelay(int $attempt, Throwable $exception): int
    {
        if ($exception instanceof RequestException && $exception->response !== null) {
            $retryAfter = $this->retryAfterMilliseconds($exception->response);

            if ($retryAfter !== null) {
                return $retryAfter;
            }
        }

        $delays = config('ai.provider_http.retry_delays_ms', [250, 750]);
        $configuredDelay = is_array($delays)
            ? ($delays[max(0, $attempt - 1)] ?? end($delays))
            : null;

        return max(0, (int) ($configuredDelay ?? 250));
    }

    private function retryAfterMilliseconds(Response $response): ?int
    {
        $value = trim((string) $response->header('Retry-After'));

        if ($value === '') {
            return null;
        }

        $seconds = is_numeric($value)
            ? (float) $value
            : max(0, (float) ((strtotime($value) ?: time()) - time()));
        $maximum = (int) config('ai.provider_http.max_retry_after_ms', 5000);

        return min($maximum, max(0, (int) ceil($seconds * 1000)));
    }

    private function throwProviderError(
        AiProviderError $error,
        AiProviderCredential $credential,
        string $model,
        ?Throwable $previous = null,
    ): never {
        Log::warning('AI provider request failed.', $error->logContext(
            $credential->provider,
            $model,
        ));

        throw new AiProviderRequestException($error, $previous);
    }
}
