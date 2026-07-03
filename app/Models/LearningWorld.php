<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'title', 'description', 'theme_config'])]
class LearningWorld extends Model
{
    /**
     * A cast tells Laravel to decode JSON columns into PHP arrays automatically.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'theme_config' => 'array',
        ];
    }

    /**
     * @return HasMany<LearningMap, $this>
     */
    public function maps(): HasMany
    {
        return $this->hasMany(LearningMap::class);
    }
}
