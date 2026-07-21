<?php

namespace App\Organizations\Serializers;

use App\Models\OrganizationIconReport;
use App\Models\User;
use DateTimeInterface;

class OrganizationIconReportSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(OrganizationIconReport $report): array
    {
        $report->loadMissing([
            'organization',
            'reporter:id,name,email',
            'iconSetter:id,name,email',
        ]);

        return [
            'id' => $report->id,
            'status' => $report->status,
            'reason' => $report->reason,
            'iconUrl' => $report->icon_url,
            'createdAt' => $this->date($report->created_at),
            'organization' => [
                'id' => $report->organization->id,
                'name' => $report->organization->name,
                'slug' => $report->organization->slug,
            ],
            'reporter' => $this->user($report->reporter),
            'iconSetter' => $report->iconSetter ? $this->user($report->iconSetter) : null,
        ];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    private function date(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
