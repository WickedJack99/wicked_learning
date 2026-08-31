<?php

namespace App\Http\Requests\Learning;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLearningDeskPlanningPreferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'purposeFilter' => ['required', 'string', Rule::in([
                'any',
                'apply',
                'explain',
                'participate',
                'reflect',
                'retrieve',
                'review',
                'transfer',
            ])],
            'timeBudget' => ['required', Rule::in(['any', 15, 30])],
        ];
    }
}
