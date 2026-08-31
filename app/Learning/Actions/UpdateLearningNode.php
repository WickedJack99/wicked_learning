<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningNodeVisualConfig;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateLearningNode
{
    public function __construct(
        private readonly LearningNodeVisualConfig $nodeVisualConfig,
        private readonly RecordLearningMapLayoutVersion $recordLayoutVersion,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, LearningNode $node, array $data): LearningNode
    {
        return DB::transaction(function () use ($data, $node, $user): LearningNode {
            $node->loadMissing('map');
            $positionChanged = (int) $node->position_q !== (int) $data['position_q']
                || (int) $node->position_r !== (int) $data['position_r'];

            if ($positionChanged) {
                $this->recordLayoutVersion->handle($user, $node->map);
            }

            $node->forceFill([
                'position_q' => $data['position_q'],
                'position_r' => $data['position_r'],
            ]);

            $this->nodeVisualConfig->fillNode($node, $node->map, $data);
            $node->save();

            return $node;
        });
    }
}
