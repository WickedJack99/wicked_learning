<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'from_activity_id',
    'to_activity_id',
    'trigger',
    'trigger_value',
    'label',
    'rules',
])]
class ActivityTransition extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rules' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function fromActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'from_activity_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function toActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'to_activity_id');
    }
}
