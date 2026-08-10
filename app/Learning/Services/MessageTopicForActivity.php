<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningMessageTopic;

class MessageTopicForActivity
{
    public function resolve(LearningActivity $activity): LearningMessageTopic
    {
        abort_unless(in_array($activity->type, MessageActivityConfiguration::TYPES, true), 404);

        $config = is_array($activity->config) ? $activity->config : [];
        $topicId = (int) ($config['messageTopicId'] ?? 0);
        $activity->loadMissing('node.mapAsset');

        $topic = LearningMessageTopic::query()
            ->whereKey($topicId)
            ->where('learning_map_asset_id', $activity->node->mapAsset?->id)
            ->first();

        abort_unless($topic instanceof LearningMessageTopic, 404);

        return $topic;
    }
}
