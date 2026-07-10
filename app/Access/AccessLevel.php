<?php

namespace App\Access;

/**
 * Permission levels are intentionally coarse so roles stay understandable.
 */
class AccessLevel
{
    public const NONE = 'none';

    public const READ = 'ro';

    public const UPDATE = 'ru';

    public const DELETE = 'rud';

    /**
     * @return array<string, int>
     */
    public static function weights(): array
    {
        return [
            self::NONE => 0,
            self::READ => 10,
            self::UPDATE => 20,
            self::DELETE => 30,
        ];
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_keys(self::weights());
    }

    public static function allows(string $actual, string $required): bool
    {
        return (self::weights()[$actual] ?? 0) >= (self::weights()[$required] ?? 0);
    }
}
