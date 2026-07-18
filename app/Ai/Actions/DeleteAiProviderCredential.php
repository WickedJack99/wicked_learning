<?php

namespace App\Ai\Actions;

use App\Models\AiProviderCredential;

class DeleteAiProviderCredential
{
    public function handle(AiProviderCredential $credential): void
    {
        $credential->delete();
    }
}
