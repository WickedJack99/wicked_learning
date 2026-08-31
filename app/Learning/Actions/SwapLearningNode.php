<?php

namespace App\Learning\Actions;

use App\Learning\Services\HexGridPositionService;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SwapLearningNode
{
    public function __construct(
        private readonly HexGridPositionService $positions,
        private readonly RecordLearningMapLayoutVersion $recordLayoutVersion,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, LearningNode $node, array $data): void
    {
        DB::transaction(function () use ($data, $node, $user): void {
            $node->loadMissing('map');
            $this->recordLayoutVersion->handle($user, $node->map);

            $this->positions->swapWithNeighbor(
                $node,
                $this->positions->directionFrom($data),
            );
        });
    }
}
