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
                    'image' => '/images/cursors/fantasy-cursor.png',
                    'hotspotX' => 4,
                    'hotspotY' => 4,
                    'size' => 32,
                    'fallback' => 'default',
                ],
                'action' => [
                    'image' => '/images/cursors/fantasy-pointer.png',
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
                'text' => [
                    'image' => '/images/cursors/fantasy-text-cursor.png',
                    'hotspotX' => 13,
                    'hotspotY' => 30,
                    'size' => 40,
                    'fallback' => 'text',
                ],
                'denied' => [
                    'image' => '/images/cursors/fantasy-denied-cursor.png',
                    'hotspotX' => 12,
                    'hotspotY' => 10,
                    'size' => 40,
                    'fallback' => 'not-allowed',
                ],
            ],
            'welcome' => [
                'pages' => [
                    [
                        'eyebrow' => 'Explorable learning platform',
                        'title' => 'Learning Worlds',
                        'body' => 'A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.',
                        'primaryLabel' => 'Enter the first world',
                        'buttons' => [
                            [
                                'text' => 'Enter the first world',
                                'target' => '/world',
                            ],
                            [
                                'text' => 'Continue learning',
                                'target' => '/login',
                            ],
                        ],
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                    [
                        'eyebrow' => 'Self-Determination Theory',
                        'title' => 'Motivation without pressure loops',
                        'body' => 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
                        'primaryLabel' => 'Read about the concept',
                        'buttons' => [
                            [
                                'text' => 'Read about the concept',
                                'target' => '/about',
                            ],
                        ],
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                    [
                        'eyebrow' => 'Configurable worlds',
                        'title' => 'One learning model, many stories',
                        'body' => 'A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
                        'primaryLabel' => 'Explore the first map',
                        'buttons' => [
                            [
                                'text' => 'Explore the first map',
                                'target' => '/world',
                            ],
                        ],
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                ],
            ],
            'infoPages' => [
                'pages' => [
                    [
                        'key' => 'about',
                        'title' => 'About',
                        'markdown' => "# About Learning Worlds\n\nLearning Worlds is an open-source experiment in building a learning environment around curiosity, autonomy, competence and meaningful progress instead of points, streaks or leaderboards.\n\n## Self-Determination Theory\n\nSelf-Determination Theory describes three basic psychological needs: autonomy, competence and relatedness. This platform uses that lens as a design compass: learners should feel agency, understand their progress and meet content through meaningful interaction rather than pressure loops.",
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                    [
                        'key' => 'imprint',
                        'title' => 'Imprint',
                        'markdown' => "# Imprint\n\nThis page is a placeholder for deployment-specific publisher information.\n\n## Responsible party\n\nAdd the legal name, address and contact details of the person or organization responsible for the deployed instance.",
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                    [
                        'key' => 'data-protection',
                        'title' => 'Data Protection',
                        'markdown' => "# Data Protection\n\nThis page is a placeholder for deployment-specific privacy and data protection information.\n\n## Learning data\n\nThe platform is intended to use learning progress only where it helps learners continue, reflect or receive useful feedback. Deployments should document which activity, answer and progress data is stored.",
                        'backgrounds' => [
                            'dark' => '',
                            'light' => '',
                        ],
                    ],
                ],
            ],
            'publicPalette' => [
                'dark' => [
                    'headingText' => '#f8fafc',
                    'headingTextOpacity' => 100,
                    'bodyText' => '#cbd5e1',
                    'bodyTextOpacity' => 100,
                    'mutedText' => '#94a3b8',
                    'mutedTextOpacity' => 100,
                    'accentText' => '#5eead4',
                    'accentTextOpacity' => 100,
                    'controlText' => '#ffffff',
                    'controlTextOpacity' => 100,
                    'controlBorder' => '#ffffff',
                    'controlBorderOpacity' => 100,
                    'welcomeOverlay' => '#020617',
                    'welcomeOverlayOpacity' => 62,
                ],
                'light' => [
                    'headingText' => '#0f172a',
                    'headingTextOpacity' => 100,
                    'bodyText' => '#475569',
                    'bodyTextOpacity' => 100,
                    'mutedText' => '#334155',
                    'mutedTextOpacity' => 100,
                    'accentText' => '#0891b2',
                    'accentTextOpacity' => 100,
                    'controlText' => '#0f172a',
                    'controlTextOpacity' => 100,
                    'controlBorder' => '#0f172a',
                    'controlBorderOpacity' => 100,
                    'welcomeOverlay' => '#ffffff',
                    'welcomeOverlayOpacity' => 72,
                ],
            ],
            'sourceLinks' => [
                'origin' => [
                    'label' => 'Origin',
                    'url' => 'https://github.com/WickedJack99/wicked_learning',
                ],
                'custom' => [],
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
