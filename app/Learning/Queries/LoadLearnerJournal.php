<?php

namespace App\Learning\Queries;

use App\Models\LearnerJournalPage;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/** Loads only the current learner's searchable journal pages. */
class LoadLearnerJournal
{
    /** @return Collection<int, LearnerJournalPage> */
    public function handle(User $user, ?string $search = null): Collection
    {
        return LearnerJournalPage::query()
            ->where('user_id', $user->id)
            ->withCount('reflections')
            ->with(['reflections' => fn ($query) => $query->latest()->limit(1)])
            ->when(trim((string) $search) !== '', function ($query) use ($search): void {
                $needle = '%'.mb_strtolower(trim((string) $search)).'%';
                $query->where(function ($inner) use ($needle): void {
                    $inner->whereRaw('LOWER(title) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(topic) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(subtopic) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(markdown) LIKE ?', [$needle]);
                });
            })
            ->latest('updated_at')
            ->get();
    }
}
