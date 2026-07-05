<?php

namespace App\Support;

class Appearance
{
    public const LIGHT = 'light';

    public const DARK = 'dark';

    public const SYSTEM = 'system';

    /**
     * User accounts store a concrete preference so the server can render the
     * first authenticated screen without waiting for browser JavaScript.
     */
    public static function forAuthenticatedUser(?string $appearance, ?string $browserAppearance = null): string
    {
        if (in_array($browserAppearance, [self::LIGHT, self::DARK], true)) {
            return $browserAppearance;
        }

        return in_array($appearance, [self::LIGHT, self::DARK], true)
            ? $appearance
            : self::LIGHT;
    }

    /**
     * Public pages can still follow the visitor's browser setting until they
     * explicitly choose a light or dark unauthenticated preference.
     */
    public static function forGuest(?string $appearance = null): string
    {
        return in_array($appearance, [self::LIGHT, self::DARK, self::SYSTEM], true)
            ? $appearance
            : self::SYSTEM;
    }
}
