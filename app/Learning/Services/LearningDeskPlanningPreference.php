<?php

namespace App\Learning\Services;

use App\Models\User;

class LearningDeskPlanningPreference
{
    public const DEFAULT_PURPOSE = 'any';

    public const DEFAULT_TIME_BUDGET = 'any';

    /** @var list<string> */
    private const PURPOSES = [
        'any',
        'apply',
        'explain',
        'participate',
        'reflect',
        'retrieve',
        'review',
        'transfer',
    ];

    /** @var list<int|string> */
    private const TIME_BUDGETS = ['any', 15, 30];

    /** @return array{purposeFilter: string, timeBudget: int|string, isSaved: bool} */
    public function forUser(?User $user): array
    {
        if ($user === null) {
            return $this->defaults();
        }

        $settings = $user->preference?->settings;
        $hasSavedPlanning = is_array($settings['learning']['deskPlanning'] ?? null);
        $planning = $hasSavedPlanning
            ? $settings['learning']['deskPlanning']
            : [];

        return [
            'isSaved' => $hasSavedPlanning,
            'purposeFilter' => $this->purpose($planning['purposeFilter'] ?? null),
            'timeBudget' => $this->timeBudget($planning['timeBudget'] ?? null),
        ];
    }

    /** @param array{purposeFilter: string, timeBudget: int|string} $planning */
    public function save(User $user, array $planning): void
    {
        $preference = $user->preference()->firstOrNew(['user_id' => $user->id]);
        $settings = is_array($preference->settings) ? $preference->settings : [];
        $learning = is_array($settings['learning'] ?? null) ? $settings['learning'] : [];

        $learning['deskPlanning'] = [
            'purposeFilter' => $this->purpose($planning['purposeFilter']),
            'timeBudget' => $this->timeBudget($planning['timeBudget']),
        ];
        $settings['learning'] = $learning;
        $preference->settings = $settings;
        $preference->save();
    }

    /** @return array{purposeFilter: string, timeBudget: int|string, isSaved: bool} */
    private function defaults(): array
    {
        return [
            'isSaved' => false,
            'purposeFilter' => self::DEFAULT_PURPOSE,
            'timeBudget' => self::DEFAULT_TIME_BUDGET,
        ];
    }

    private function purpose(mixed $value): string
    {
        return is_string($value) && in_array($value, self::PURPOSES, true)
            ? $value
            : self::DEFAULT_PURPOSE;
    }

    private function timeBudget(mixed $value): int|string
    {
        return (is_int($value) || is_string($value)) && in_array($value, self::TIME_BUDGETS, true)
            ? $value
            : self::DEFAULT_TIME_BUDGET;
    }
}
