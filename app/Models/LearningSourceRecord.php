<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['anchor', 'created_by', 'excerpt', 'published_at', 'publisher', 'rights', 'title', 'url'])]
class LearningSourceRecord extends Model
{
    protected function casts(): array
    {
        return [
            'published_at' => 'date:Y-m-d',
        ];
    }
}
