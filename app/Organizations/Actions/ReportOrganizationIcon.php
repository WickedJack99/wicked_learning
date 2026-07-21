<?php

namespace App\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationIconReport;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ReportOrganizationIcon
{
    public function handle(Organization $organization, User $reporter, ?string $reason = null): OrganizationIconReport
    {
        if (! $organization->icon_url) {
            throw ValidationException::withMessages([
                'icon' => 'This organization has no icon to report.',
            ]);
        }

        return $organization->iconReports()->create([
            'reported_by_user_id' => $reporter->id,
            'icon_set_by_user_id' => $organization->icon_set_by_user_id,
            'icon_url' => $organization->icon_url,
            'reason' => $reason,
            'status' => OrganizationIconReport::STATUS_PENDING,
        ]);
    }
}
