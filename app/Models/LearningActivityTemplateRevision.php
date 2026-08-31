<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'created_by_user_id',
    'learning_activity_template_id',
    'name',
    'snapshot',
    'type',
])]
class LearningActivityTemplateRevision extends Model
{
    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningActivityTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(LearningActivityTemplate::class, 'learning_activity_template_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
