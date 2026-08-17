<?php

namespace App\Ai\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

class AiProviderError
{
    private const NON_RETRYABLE_LIMIT_CODES = [
        'billing_hard_limit_reached',
        'credit_balance_exhausted',
        'insufficient_quota',
        'organization_spend_limit_exceeded',
        'organization_usage_limit_exceeded',
        'project_spend_limit_exceeded',
    ];

    public function __construct(
        public readonly string $category,
        public readonly string $code,
        public readonly string $message,
        public readonly ?string $parameter,
        public readonly ?int $providerStatus,
        public readonly ?string $requestId,
        public readonly string $clientRequestId,
        public readonly bool $retryable,
    ) {}

    public static function fromResponse(Response $response, string $clientRequestId): self
    {
        $status = $response->status();
        $code = self::stringValue($response->json('error.code'))
            ?? self::stringValue($response->json('error.type'))
            ?? 'provider_http_error';
        $parameter = self::stringValue($response->json('error.param'));
        $providerMessage = self::cleanMessage($response->json('error.message'));
        $retryable = self::responseIsRetryable($response);
        $category = self::category($status, $retryable);

        return new self(
            category: $category,
            code: $code,
            message: self::userMessage($category, $providerMessage),
            parameter: $parameter,
            providerStatus: $status,
            requestId: self::stringValue($response->header('x-request-id')),
            clientRequestId: $clientRequestId,
            retryable: $retryable,
        );
    }

    public static function connection(string $clientRequestId): self
    {
        return new self(
            category: 'connection',
            code: 'provider_connection_failed',
            message: 'The AI provider could not be reached. Check the provider URL and network connection, then try again.',
            parameter: null,
            providerStatus: null,
            requestId: null,
            clientRequestId: $clientRequestId,
            retryable: true,
        );
    }

    public static function responseIsRetryable(Response $response): bool
    {
        $status = $response->status();

        if (in_array($status, [408, 409, 500, 502, 503, 504], true)) {
            return true;
        }

        if ($status !== 429) {
            return false;
        }

        $code = self::stringValue($response->json('error.code'))
            ?? self::stringValue($response->json('error.type'));

        return ! in_array($code, self::NON_RETRYABLE_LIMIT_CODES, true);
    }

    public function applicationStatus(): int
    {
        return match ($this->category) {
            'rate_limit' => 429,
            'connection', 'provider_unavailable' => 503,
            default => 422,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function publicDetails(): array
    {
        return [
            'category' => $this->category,
            'code' => $this->code,
            'parameter' => $this->parameter,
            'providerStatus' => $this->providerStatus,
            'requestId' => $this->requestId ?? $this->clientRequestId,
            'retryable' => $this->retryable,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function logContext(string $provider, string $model): array
    {
        return [
            'provider' => $provider,
            'model' => $model,
            'category' => $this->category,
            'provider_status' => $this->providerStatus,
            'provider_code' => $this->code,
            'parameter' => $this->parameter,
            'request_id' => $this->requestId,
            'client_request_id' => $this->clientRequestId,
            'retryable' => $this->retryable,
        ];
    }

    private static function category(int $status, bool $retryable): string
    {
        if ($status === 401) {
            return 'authentication';
        }

        if ($status === 403) {
            return 'permission';
        }

        if ($status === 404) {
            return 'not_found';
        }

        if ($status === 429) {
            return $retryable ? 'rate_limit' : 'quota';
        }

        if ($status >= 500) {
            return 'provider_unavailable';
        }

        if (in_array($status, [400, 422], true)) {
            return 'invalid_request';
        }

        return 'provider_error';
    }

    private static function userMessage(string $category, ?string $providerMessage): string
    {
        return match ($category) {
            'authentication' => 'The AI provider rejected the saved credentials. Check the API key and organization settings.',
            'permission' => 'The saved provider key does not have permission to use this endpoint or model.',
            'not_found' => 'The configured AI model or provider endpoint was not found.',
            'quota' => 'The AI provider account has no available credits or has reached a configured usage limit.',
            'rate_limit' => 'The AI provider is temporarily rate-limiting requests. Try again shortly.',
            'provider_unavailable' => 'The AI provider is temporarily unavailable. Try again shortly.',
            'invalid_request' => $providerMessage !== null
                ? "The AI provider rejected this configuration: {$providerMessage}"
                : 'The AI provider rejected this request configuration.',
            default => 'The AI provider could not complete the request.',
        };
    }

    private static function cleanMessage(mixed $message): ?string
    {
        if (! is_string($message) || trim($message) === '') {
            return null;
        }

        $cleaned = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', trim($message));

        return Str::limit(trim((string) $cleaned), 500);
    }

    private static function stringValue(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
