<?php

namespace App\Organizations\Actions;

use App\Models\OrganizationIconReport;
use App\Models\User;

class ResolveOrganizationIconReport
{
    public function handle(OrganizationIconReport $report, User $admin, bool $removeIcon): void
    {
        if ($removeIcon) {
            $report->organization->forceFill([
                'icon_url' => null,
                'icon_set_by_user_id' => null,
            ])->save();
        }

        $report->forceFill([
            'status' => $removeIcon
                ? OrganizationIconReport::STATUS_RESOLVED
                : OrganizationIconReport::STATUS_DISMISSED,
            'resolved_by_user_id' => $admin->id,
            'resolved_at' => now(),
        ])->save();
    }
}
