<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'aura_threshold',
    'description',
    'emittance_threshold',
    'growth_threshold',
    'is_active',
    'name',
    'slug',
])]
class CompetenceTopicDefinition extends Model
{
    protected function casts(): array
    {
        return [
            'aura_threshold' => 'decimal:2',
            'emittance_threshold' => 'decimal:2',
            'growth_threshold' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
