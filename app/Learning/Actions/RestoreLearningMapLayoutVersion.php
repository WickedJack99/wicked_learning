<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\LearningMapLayoutVersion;
use App\Models\LearningNode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestoreLearningMapLayoutVersion
{
    public function __construct(private readonly RecordLearningMapLayoutVersion $recordVersion) {}

    public function handle(
        User $user,
        LearningMap $map,
        LearningMapLayoutVersion $version,
    ): LearningMap {
        return DB::transaction(function () use ($map, $user, $version): LearningMap {
            $nodes = $map->nodes()
                ->orderBy('id')
                ->get(['id', 'position_q', 'position_r']);
            $snapshot = $this->normalizedSnapshot($version->snapshot);
            $currentIds = $nodes->pluck('id')->map(fn (mixed $id): int => (int) $id)->sort()->values()->all();
            $snapshotIds = collect($snapshot)->pluck('nodeId')->sort()->values()->all();

            if ($currentIds !== $snapshotIds) {
                throw ValidationException::withMessages([
                    'version' => 'This layout cannot be restored after nodes were added or removed.',
                ]);
            }

            $positionKeys = collect($snapshot)
                ->map(fn (array $node): string => $node['positionQ'].':'.$node['positionR'])
                ->all();

            if (count($positionKeys) !== count(array_unique($positionKeys))) {
                throw ValidationException::withMessages([
                    'version' => 'This layout contains duplicate tile positions and cannot be restored.',
                ]);
            }

            $this->recordVersion->handle($user, $map);
            $temporaryBase = $this->temporaryBase($nodes);

            foreach ($nodes as $index => $node) {
                $node->forceFill([
                    'position_q' => $temporaryBase + $index,
                    'position_r' => $temporaryBase + $index,
                ])->save();
            }

            $positionsByNodeId = collect($snapshot)->keyBy('nodeId');

            foreach ($nodes as $node) {
                $position = $positionsByNodeId->get($node->id);
                $node->forceFill([
                    'position_q' => $position['positionQ'],
                    'position_r' => $position['positionR'],
                ])->save();
            }

            return $map->refresh();
        });
    }

    /** @param array<int, mixed>|null $snapshot */
    private function normalizedSnapshot(?array $snapshot): array
    {
        $normalized = [];

        foreach ($snapshot ?? [] as $node) {
            if (! is_array($node) || ! isset($node['nodeId'], $node['positionQ'], $node['positionR'])) {
                throw ValidationException::withMessages([
                    'version' => 'This layout history entry is incomplete.',
                ]);
            }

            $normalized[] = [
                'nodeId' => (int) $node['nodeId'],
                'positionQ' => (int) $node['positionQ'],
                'positionR' => (int) $node['positionR'],
            ];
        }

        return $normalized;
    }

    /** @param iterable<int, LearningNode> $nodes */
    private function temporaryBase(iterable $nodes): int
    {
        $largestCoordinate = 0;

        foreach ($nodes as $node) {
            $largestCoordinate = max(
                $largestCoordinate,
                abs((int) $node->position_q),
                abs((int) $node->position_r),
            );
        }

        return $largestCoordinate + 1000;
    }
}
