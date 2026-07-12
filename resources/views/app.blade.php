<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const isAppearance = (value) => ['light', 'dark', 'system'].includes(value);
                const rawServerAppearance = '{{ $appearance ?? "system" }}';
                const serverAppearance = isAppearance(rawServerAppearance) ? rawServerAppearance : 'system';
                const isAuthenticated = @json(auth()->check());
                let storedAppearance = null;

                try {
                    storedAppearance = localStorage.getItem(
                        isAuthenticated ? 'appearance' : 'theme-preference-unauthenticated'
                    );
                } catch (error) {
                    storedAppearance = null;
                }

                storedAppearance = isAppearance(storedAppearance) ? storedAppearance : null;

                const appearance = serverAppearance !== 'system'
                    ? serverAppearance
                    : storedAppearance || serverAppearance;
                window.__INITIAL_AUTHENTICATED__ = isAuthenticated;
                window.__INITIAL_APPEARANCE__ = appearance;
                const shouldUseDarkMode = appearance === 'dark'
                    || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                const initialBackground = shouldUseDarkMode ? '#0b1117' : '#f8fafc';

                document.documentElement.classList.toggle('dark', shouldUseDarkMode);
                document.documentElement.style.colorScheme = shouldUseDarkMode ? 'dark' : 'light';
                document.documentElement.style.setProperty('--initial-page-background', initialBackground);
                document.documentElement.style.backgroundColor = initialBackground;
                window.__INITIAL_RESOLVED_APPEARANCE__ = shouldUseDarkMode ? 'dark' : 'light';
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html,
            body {
                background-color: var(--initial-page-background, #0b1117);
            }

            #app,
            [data-page] {
                min-height: 100%;
            }
        </style>

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
