<?php

namespace App\Learning\Actions;

use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;

class ResetLearningNodeUnlocks
{
    public function handle(LearningNode $node): int
    {
        $resetCount = 0;

        LearnerNodeDiscovery::query()
            ->where('learning_node_id', $node->id)
            ->each(function (LearnerNodeDiscovery $discovery) use (&$resetCount): void {
                if ($this->removeUnlockMetadata($discovery)) {
                    $resetCount++;
                }
            });

        return $resetCount;
    }

    private function removeUnlockMetadata(LearnerNodeDiscovery $discovery): bool
    {
        $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];

        if (! array_key_exists('unlock', $metadata)) {
            return false;
        }

        unset($metadata['unlock']);

        $discovery->metadata = $metadata === [] ? null : $metadata;
        $discovery->save();

        return true;
    }
}
