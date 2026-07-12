<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformPresentationSetting extends Model
{
    private const DEFAULT_KEY = 'public_presentation';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'updated_by_user_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    /**
     * Return the public presentation settings with defaults filled in.
     *
     * @return array<string, mixed>
     */
    public static function current(): array
    {
        $stored = self::query()
            ->where('key', self::DEFAULT_KEY)
            ->value('value');

        return self::mergeSettings(self::defaults(), is_array($stored) ? $stored : []);
    }

    /**
     * Store the public presentation settings.
     *
     * @param  array<string, mixed>  $settings
     */
    public static function updateCurrent(array $settings, User $user): void
    {
        self::query()->updateOrCreate(
            ['key' => self::DEFAULT_KEY],
            [
                'value' => self::mergeSettings(self::defaults(), $settings),
                'updated_by_user_id' => $user->id,
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            'auth' => [
                'backgroundImages' => [
                    'login' => [
                        'dark' => '',
                        'light' => '',
                    ],
                    'register' => [
                        'dark' => '',
                        'light' => '',
                    ],
                    'welcome' => [
                        'dark' => '',
                        'light' => '',
                    ],
                ],
            ],
            'cursors' => [
                'default' => [
                    'image' => '/images/cursors/default-cursor.svg',
                    'hotspotX' => 4,
                    'hotspotY' => 4,
                    'size' => 32,
                    'fallback' => 'default',
                ],
                'action' => [
                    'image' => '/images/cursors/action-pointer.svg',
                    'hotspotX' => 12,
                    'hotspotY' => 4,
                    'size' => 32,
                    'fallback' => 'pointer',
                ],
                'grab' => [
                    'image' => '/images/cursors/fantasy-grab-backhand.png',
                    'hotspotX' => 12,
                    'hotspotY' => 10,
                    'size' => 40,
                    'fallback' => 'grab',
                ],
            ],
            'welcome' => [
                'pages' => [
                    [
                        'eyebrow' => 'Explorable learning platform',
                        'title' => 'Learning Worlds',
                        'body' => 'A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.',
                        'primaryLabel' => 'Enter the first world',
                    ],
                    [
                        'eyebrow' => 'Self-Determination Theory',
                        'title' => 'Motivation without pressure loops',
                        'body' => 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
                        'primaryLabel' => 'Read about the concept',
                    ],
                    [
                        'eyebrow' => 'Configurable worlds',
                        'title' => 'One learning model, many stories',
                        'body' => 'A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
                        'primaryLabel' => 'Explore the first map',
                    ],
                ],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $defaults
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private static function mergeSettings(array $defaults, array $settings): array
    {
        return array_replace_recursive($defaults, $settings);
    }
}
