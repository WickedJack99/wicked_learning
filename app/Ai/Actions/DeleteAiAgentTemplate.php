<?php

namespace App\Ai\Actions;

use App\Models\AiAgentTemplate;

class DeleteAiAgentTemplate
{
    public function handle(AiAgentTemplate $template): void
    {
        $template->delete();
    }
}
