<?php

namespace App\Learning\Queries;

use App\Models\LearnerJournalPage;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/** Loads only the current learner's searchable journal pages. */
class LoadLearnerJournal
{
    public const DEFAULT_PAGE_SIZE = 4;

    public const MAX_PAGE_SIZE = 24;

    /** @return Collection<int, LearnerJournalPage> */
    public function handle(User $user, ?string $search = null): Collection
    {
        return $this->query($user, $search)->get();
    }

    /**
     * @return LengthAwarePaginator<int, LearnerJournalPage>
     */
    public function paginate(
        User $user,
        ?string $search = null,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $this->query($user, $search)->paginate(
            perPage: min(max(1, $perPage), self::MAX_PAGE_SIZE),
            page: max(1, $page),
        );
    }

    /**
     * @return Builder<LearnerJournalPage>
     */
    private function query(User $user, ?string $search = null): Builder
    {
        return LearnerJournalPage::query()
            ->where('user_id', $user->id)
            ->withCount('reflections')
            ->with([
                'feedbackRequest',
                'reflections.learningNode.map.topic',
                'reflections.learningActivity',
                'reflections' => fn ($query) => $query->latest()->limit(1),
            ])
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
            ->latest('id');
    }
}
