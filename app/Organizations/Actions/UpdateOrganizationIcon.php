<?php

namespace App\Organizations\Actions;

use App\Learning\Services\LearningMediaUploadService;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class UpdateOrganizationIcon
{
    public function __construct(private readonly LearningMediaUploadService $mediaUpload) {}

    /**
     * @return array{durationSeconds: float|null, url: string}
     */
    public function handle(Organization $organization, User $user, mixed $file): array
    {
        if (! $organization->isLeader($user)) {
            throw ValidationException::withMessages([
                'organization' => 'Only organization leaders can set the icon.',
            ]);
        }

        $payload = $this->mediaUpload->upload($file, 'organizations/icons');

        $organization->forceFill([
            'icon_url' => $payload['url'],
            'icon_set_by_user_id' => $user->id,
        ])->save();

        return $payload;
    }
}
