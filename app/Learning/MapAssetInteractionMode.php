<?php

namespace App\Learning;

enum MapAssetInteractionMode: string
{
    case Focusable = 'focusable';
    case Decorative = 'decorative';
    case HideOnHover = 'hide_on_hover';
    case Toggle = 'toggle';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(
            static fn (self $mode): string => $mode->value,
            self::cases(),
        );
    }

    public function opensLearnerPanel(): bool
    {
        return $this === self::Focusable;
    }
}
