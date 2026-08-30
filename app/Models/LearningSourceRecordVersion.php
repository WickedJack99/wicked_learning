<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'anchor',
    'changed_by',
    'excerpt',
    'learning_source_record_id',
    'published_at',
    'publisher',
    'rights',
    'title',
    'url',
])]
class LearningSourceRecordVersion extends Model
{
    protected function casts(): array
    {
        return ['published_at' => 'date:Y-m-d'];
    }
}
