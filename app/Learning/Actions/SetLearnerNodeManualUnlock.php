<?php

namespace App\Learning\Actions;

use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Support\Carbon;

class SetLearnerNodeManualUnlock
{
    public function handle(User $learner, LearningNode $node, User $actor, bool $enabled): void
    {
        $discovery = LearnerNodeDiscovery::query()->firstOrNew([
            'user_id' => $learner->id,
            'learning_node_id' => $node->id,
        ]);
        $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];

        if ($enabled) {
            $metadata['manualUnlock'] = [
                'grantedAt' => Carbon::now()->toIso8601String(),
                'grantedByUserId' => $actor->id,
            ];
            $discovery->discovered_at ??= Carbon::now();
        } else {
            unset($metadata['manualUnlock']);
        }

        $discovery->metadata = $metadata === [] ? null : $metadata;
        $discovery->save();
    }
}
