<?php

namespace App\Learning\Services;

class SubmittedConfigMerger
{
    /**
     * Merge editable config fields into existing JSON while allowing submitted
     * empty strings to clear earlier values.
     *
     * @param  array<int|string, mixed>  $existing
     * @param  array<int|string, mixed>  $incoming
     * @return array<int|string, mixed>
     */
    public function merge(array $existing, array $incoming): array
    {
        foreach ($incoming as $key => $value) {
            if (is_array($value)) {
                $this->mergeNestedValue($existing, $key, $value);

                continue;
            }

            $this->mergeScalarValue($existing, $key, $value);
        }

        return $existing;
    }

    /**
     * @param  array<int|string, mixed>  $existing
     * @param  array<int|string, mixed>  $value
     */
    private function mergeNestedValue(array &$existing, string|int $key, array $value): void
    {
        $merged = $this->merge(
            is_array($existing[$key] ?? null) ? $existing[$key] : [],
            $value,
        );

        if ($merged === []) {
            unset($existing[$key]);

            return;
        }

        $existing[$key] = $merged;
    }

    /**
     * @param  array<int|string, mixed>  $existing
     */
    private function mergeScalarValue(array &$existing, string|int $key, mixed $value): void
    {
        if ($value === null || $value === '') {
            unset($existing[$key]);

            return;
        }

        $existing[$key] = $value;
    }
}
