<?php

namespace App\Organizations\Queries;

use App\Models\OrganizationIconReport;
use Illuminate\Database\Eloquent\Collection;

class LoadPendingOrganizationIconReports
{
    /**
     * @return Collection<int, OrganizationIconReport>
     */
    public function handle(): Collection
    {
        return OrganizationIconReport::query()
            ->with([
                'organization',
                'reporter:id,name,email',
                'iconSetter:id,name,email',
            ])
            ->where('status', OrganizationIconReport::STATUS_PENDING)
            ->latest()
            ->get();
    }
}
