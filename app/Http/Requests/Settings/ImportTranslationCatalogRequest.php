<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class ImportTranslationCatalogRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'catalog' => ['required', 'file', 'max:2048', 'mimetypes:application/json,text/plain'],
        ];
    }
}
