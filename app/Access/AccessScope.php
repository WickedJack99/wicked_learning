<?php

namespace App\Access;

/** Defines how far a granted permission may reach. */
class AccessScope
{
    public const NONE = 'none';

    public const OWN = 'own';

    public const ASSIGNED = 'assigned';

    public const GROUP = 'group';

    public const ALL = 'all';

    /** @return array<string, int> */
    public static function weights(): array
    {
        return [
            self::NONE => 0,
            self::OWN => 10,
            self::ASSIGNED => 20,
            self::GROUP => 30,
            self::ALL => 40,
        ];
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_keys(self::weights());
    }

    public static function allows(string $actual, string $required): bool
    {
        return (self::weights()[$actual] ?? 0) >= (self::weights()[$required] ?? 0);
    }
}
