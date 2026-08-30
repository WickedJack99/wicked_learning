<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LearningCompanionTurnRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'surface' => ['required', 'string', Rule::in(['activity', 'desk', 'world'])],
            'dialogue_node_id' => ['required', 'string', 'max:80'],
            'assistance_level' => ['required', 'string', Rule::in(['off', 'question', 'hint', 'post-attempt'])],
            'map_id' => ['nullable', 'integer', 'min:1'],
            'node_id' => ['nullable', 'integer', 'min:1'],
            'activity_id' => ['nullable', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('surface') !== 'activity') {
            $this->merge(['node_id' => null, 'activity_id' => null]);
        }

        if ($this->input('surface') !== 'world') {
            $this->merge(['map_id' => null]);
        }
    }

    /** @return array<string, mixed> */
    public function validatedForTurn(): array
    {
        $data = $this->validated();

        if ($data['surface'] === 'activity' && ! isset($data['node_id'])) {
            throw ValidationException::withMessages([
                'node_id' => 'An activity companion turn needs a learning place.',
            ]);
        }

        return $data;
    }
}
