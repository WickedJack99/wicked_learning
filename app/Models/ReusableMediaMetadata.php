<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'url',
    'display_name',
    'category',
    'tags',
    'has_transparency',
    'is_animated',
])]
class ReusableMediaMetadata extends Model
{
    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'has_transparency' => 'boolean',
            'is_animated' => 'boolean',
        ];
    }
}
