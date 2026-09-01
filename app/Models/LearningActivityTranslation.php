<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alternate-language learner copy for a single activity.
 * It is never shared in global Inertia props or generic language catalogs.
 *
 * @property array<string, mixed> $content
 */
#[Fillable(['learning_activity_id', 'locale', 'content'])]
class LearningActivityTranslation extends Model
{
    protected function casts(): array
    {
        return [
            'content' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }
}
