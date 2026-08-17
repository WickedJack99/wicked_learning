<?php

namespace App\Ai\Exceptions;

use App\Ai\Support\AiProviderError;
use RuntimeException;
use Throwable;

class AiProviderRequestException extends RuntimeException
{
    public function __construct(
        public readonly AiProviderError $providerError,
        ?Throwable $previous = null,
    ) {
        parent::__construct($providerError->message, 0, $previous);
    }
}
