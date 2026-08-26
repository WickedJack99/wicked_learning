<?php

namespace App\Learning\Services;

class CompetenceVisualScale
{
    /**
     * Convert stored learning signals into stable, presentation-neutral map values.
     *
     * The numeric inputs remain internal implementation details. Learners receive
     * visual ratios and a human description instead of a score or point total.
     *
     * @param  list<string>  $evidenceTypes
     * @param  list<string>  $learningPeriods
     * @param  list<array<string, mixed>>  $evidenceLedger
     * @return array{
     *     auraRatio: float,
     *     brightnessRatio: float,
     *     description: string,
     *     evidenceLedger: list<array<string, mixed>>,
     *     evidenceTypes: list<string>,
     *     learningPeriods: list<string>,
     *     recentDescription: string,
     *     sizeRatio: float,
     *     sizeTier: string
     * }
     */
    public function forTopic(
        float $totalSignal,
        float $recentSignal,
        float $growthThreshold,
        float $brightnessThreshold,
        float $auraThreshold,
        array $evidenceTypes = [],
        array $learningPeriods = [],
        array $evidenceLedger = [],
    ): array {
        $sizeRatio = $this->ratio($totalSignal, $growthThreshold);
        $brightnessRatio = $this->ratio($recentSignal, $brightnessThreshold);
        $auraRatio = $this->ratio($recentSignal, $auraThreshold);
        $sizeTier = $this->tier($sizeRatio);

        return [
            'auraRatio' => $auraRatio,
            'brightnessRatio' => $brightnessRatio,
            'description' => $this->description($sizeTier),
            'evidenceLedger' => $evidenceLedger,
            'evidenceTypes' => $evidenceTypes,
            'learningPeriods' => $learningPeriods,
            'recentDescription' => $this->recentDescription($auraRatio),
            'sizeRatio' => $sizeRatio,
            'sizeTier' => $sizeTier,
        ];
    }

    private function ratio(float $value, float $threshold): float
    {
        if ($value <= 0 || $threshold <= 0) {
            return 0.0;
        }

        return round(min(1.0, $value / $threshold), 4);
    }

    private function tier(float $ratio): string
    {
        return match (true) {
            $ratio >= 1 => 'constellation',
            $ratio >= (2 / 3) => 'beacon',
            $ratio >= 0.34 => 'star',
            default => 'spark',
        };
    }

    private function description(string $tier): string
    {
        return match ($tier) {
            'constellation' => 'A strong, well-established light.',
            'beacon' => 'A well-established light.',
            'star' => 'A growing light.',
            default => 'A newly emerging light.',
        };
    }

    private function recentDescription(float $auraRatio): string
    {
        return match (true) {
            $auraRatio >= 1 => 'Recent learning moments are strongly lighting this area.',
            $auraRatio >= 0.5 => 'Recent learning moments are gently lighting this area.',
            $auraRatio > 0 => 'A recent learning moment is gently lighting this area.',
            default => 'The glow is resting for now; the established pattern remains.',
        };
    }
}
