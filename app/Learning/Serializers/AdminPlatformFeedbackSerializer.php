<?php

namespace App\Learning\Serializers;

use App\Models\PlatformFeedback;
use DateTimeInterface;

/** Shapes deliberately shared platform feedback for authorized administrators. */
class AdminPlatformFeedbackSerializer
{
    /** @return array<string, mixed> */
    public function serialize(PlatformFeedback $feedback): array
    {
        return [
            'category' => $feedback->category,
            'id' => $feedback->id,
            'message' => $feedback->message,
            'reviewedAt' => $this->date($feedback->reviewed_at),
            'submittedAt' => $this->date($feedback->submitted_at),
            'user' => [
                'email' => $feedback->user?->email,
                'id' => $feedback->user?->id,
                'name' => $feedback->user?->name,
            ],
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
