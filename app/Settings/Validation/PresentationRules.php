<?php

namespace App\Settings\Validation;

class PresentationRules
{
    /**
     * @return array<string, mixed>
     */
    public function update(): array
    {
        return [
            ...$this->authBackgrounds(),
            ...$this->cursors(),
            ...$this->welcomePages(),
            ...$this->informationPages(),
            ...$this->publicPalette(),
            ...$this->sourceLinks(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function backgroundImageUpload(): array
    {
        return ['image' => ['required', 'file', 'max:5120']];
    }

    /**
     * @return array<string, mixed>
     */
    private function authBackgrounds(): array
    {
        $rules = [];

        foreach (['login', 'register', 'welcome'] as $screen) {
            foreach (['dark', 'light'] as $mode) {
                $rules["auth.backgroundImages.{$screen}.{$mode}"] = ['nullable', 'string', 'max:2048'];
            }
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    private function cursors(): array
    {
        $rules = [];

        foreach (['default', 'action', 'grab', 'text', 'denied'] as $cursor) {
            $rules["cursors.{$cursor}.image"] = ['nullable', 'string', 'max:2048'];
            $rules["cursors.{$cursor}.hotspotX"] = ['nullable', 'integer', 'min:0', 'max:64'];
            $rules["cursors.{$cursor}.hotspotY"] = ['nullable', 'integer', 'min:0', 'max:64'];
            $rules["cursors.{$cursor}.size"] = ['nullable', 'integer', 'min:16', 'max:128'];
            $rules["cursors.{$cursor}.fallback"] = ['nullable', 'string', 'max:32'];
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    private function welcomePages(): array
    {
        return [
            'welcome.pages' => ['required', 'array', 'min:1', 'max:12'],
            'welcome.pages.*.backgrounds.dark' => ['nullable', 'string', 'max:2048'],
            'welcome.pages.*.backgrounds.light' => ['nullable', 'string', 'max:2048'],
            'welcome.pages.*.eyebrow' => ['required', 'string', 'max:120'],
            'welcome.pages.*.title' => ['required', 'string', 'max:160'],
            'welcome.pages.*.body' => ['required', 'string', 'max:1200'],
            'welcome.pages.*.primaryLabel' => ['nullable', 'string', 'max:80'],
            'welcome.pages.*.buttons' => ['nullable', 'array', 'max:6'],
            'welcome.pages.*.buttons.*.text' => ['required', 'string', 'max:80'],
            'welcome.pages.*.buttons.*.target' => ['required', 'string', 'max:2048'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function informationPages(): array
    {
        return [
            'infoPages.pages' => ['nullable', 'array', 'max:24'],
            'infoPages.pages.*.key' => ['required', 'string', 'regex:/^[a-z0-9-]+$/', 'max:80'],
            'infoPages.pages.*.title' => ['required', 'string', 'max:120'],
            'infoPages.pages.*.markdown' => ['required', 'string', 'max:50000'],
            'infoPages.pages.*.backgrounds.dark' => ['nullable', 'string', 'max:2048'],
            'infoPages.pages.*.backgrounds.light' => ['nullable', 'string', 'max:2048'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function publicPalette(): array
    {
        $rules = [];

        foreach (['dark', 'light'] as $mode) {
            foreach ([
                'headingText',
                'bodyText',
                'mutedText',
                'accentText',
                'controlText',
                'controlBorder',
                'welcomeOverlay',
            ] as $field) {
                $rules["publicPalette.{$mode}.{$field}"] = ['nullable', 'string', 'max:64'];
                $rules["publicPalette.{$mode}.{$field}Opacity"] = ['nullable', 'integer', 'min:0', 'max:100'];
            }
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    private function sourceLinks(): array
    {
        return [
            'sourceLinks.origin.label' => ['required', 'string', 'max:80'],
            'sourceLinks.origin.url' => ['required', 'url', 'max:2048'],
            'sourceLinks.custom' => ['nullable', 'array', 'max:12'],
            'sourceLinks.custom.*.label' => ['required', 'string', 'max:80'],
            'sourceLinks.custom.*.url' => ['required', 'url', 'max:2048'],
        ];
    }
}
