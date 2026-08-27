<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningMapAsset;
use App\Models\LearningMessageTopic;
use App\Models\LearningNode;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Stores the shared topic and visual contract used by both message activities. */
class MessageActivityConfiguration
{
    public const TYPES = ['message_prompt', 'message_wall'];

    public const AUDIENCES = ['peers', 'support'];

    /** @param array<string, mixed> $data @param array<string, mixed> $existing @return array<string, mixed> */
    public function fromData(LearningNode $node, array $data, array $existing = []): array
    {
        return [
            ...$existing,
            'messageTopicId' => $this->topic($node, $data, $existing)->id,
            'messageAudience' => $this->audience($data, $existing),
            'messagePrompt' => $this->string($data, 'message_prompt_text', $existing, 'messagePrompt', 'Leave a helpful note or an encouraging thought for the next learner.'),
            'messageInputLabel' => $this->string($data, 'message_input_label', $existing, 'messageInputLabel', 'Your message'),
            'messageUi' => [
                'surfaceColorDark' => $this->color($data, 'message_surface_color_dark', $existing, 'surfaceColorDark', '#071018'),
                'surfaceColorLight' => $this->color($data, 'message_surface_color_light', $existing, 'surfaceColorLight', '#e6f5f2'),
                'cardColorDark' => $this->color($data, 'message_card_color_dark', $existing, 'cardColorDark', '#13262d'),
                'cardColorLight' => $this->color($data, 'message_card_color_light', $existing, 'cardColorLight', '#ffffff'),
                'cardBorderColorDark' => $this->color($data, 'message_card_border_color_dark', $existing, 'cardBorderColorDark', '#2dd4bf'),
                'cardBorderColorLight' => $this->color($data, 'message_card_border_color_light', $existing, 'cardBorderColorLight', '#0f766e'),
                'textColorDark' => $this->color($data, 'message_text_color_dark', $existing, 'textColorDark', '#f1f5f9'),
                'textColorLight' => $this->color($data, 'message_text_color_light', $existing, 'textColorLight', '#0f172a'),
                'accentColorDark' => $this->color($data, 'message_accent_color_dark', $existing, 'accentColorDark', '#5eead4'),
                'accentColorLight' => $this->color($data, 'message_accent_color_light', $existing, 'accentColorLight', '#0f766e'),
            ],
        ];
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $updates */
    public function shouldUpdate(array $data, array $updates): bool
    {
        return array_key_exists('type', $updates) || array_intersect_key($data, array_flip([
            'message_topic_id',
            'message_topic_title',
            'message_audience',
            'message_prompt_text',
            'message_input_label',
            'message_surface_color_dark',
            'message_surface_color_light',
            'message_card_color_dark',
            'message_card_color_light',
            'message_card_border_color_dark',
            'message_card_border_color_light',
            'message_text_color_dark',
            'message_text_color_light',
            'message_accent_color_dark',
            'message_accent_color_light',
        ])) !== [];
    }

    public function audienceFor(LearningActivity $activity): string
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return $activity->type === 'message_prompt'
            && ($config['messageAudience'] ?? null) === 'support'
            ? 'support'
            : 'peers';
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function topic(LearningNode $node, array $data, array $existing): LearningMessageTopic
    {
        $asset = $node->mapAsset()->first();

        if (! $asset instanceof LearningMapAsset) {
            throw ValidationException::withMessages([
                'message_topic_id' => 'This activity needs a MapAsset before a message topic can be linked.',
            ]);
        }

        $topicId = is_numeric($data['message_topic_id'] ?? null)
            ? (int) $data['message_topic_id']
            : (int) ($existing['messageTopicId'] ?? 0);

        if ($topicId > 0) {
            $topic = $asset->messageTopics()->whereKey($topicId)->first();

            if ($topic instanceof LearningMessageTopic) {
                return $topic;
            }
        }

        $title = trim((string) ($data['message_topic_title'] ?? ''));

        if ($title === '') {
            throw ValidationException::withMessages([
                'message_topic_title' => 'Choose an existing message topic or name a new one.',
            ]);
        }

        $slug = Str::slug($title) ?: 'learner-messages';

        return $asset->messageTopics()->firstOrCreate(
            ['slug' => $slug],
            ['title' => $title],
        );
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function string(array $data, string $field, array $existing, string $key, string $fallback): string
    {
        return array_key_exists($field, $data)
            ? trim((string) $data[$field])
            : (string) ($existing[$key] ?? $fallback);
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function audience(array $data, array $existing): string
    {
        if (($data['type'] ?? null) === 'message_wall') {
            return 'peers';
        }

        $value = array_key_exists('message_audience', $data)
            ? (string) $data['message_audience']
            : (string) ($existing['messageAudience'] ?? 'peers');

        return in_array($value, self::AUDIENCES, true) ? $value : 'peers';
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $existing */
    private function color(array $data, string $field, array $existing, string $key, string $fallback): string
    {
        $ui = is_array($existing['messageUi'] ?? null) ? $existing['messageUi'] : [];
        $value = array_key_exists($field, $data) ? (string) $data[$field] : (string) ($ui[$key] ?? $fallback);

        return preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtolower($value) : $fallback;
    }
}
