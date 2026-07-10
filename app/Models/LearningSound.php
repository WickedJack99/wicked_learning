<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'slug', 'icon', 'url', 'volume', 'play_seconds', 'loop'])]
class LearningSound extends Model
{
    protected function casts(): array
    {
        return [
            'loop' => 'boolean',
            'play_seconds' => 'float',
            'volume' => 'float',
        ];
    }
}
