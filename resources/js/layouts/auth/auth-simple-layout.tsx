import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import AppearanceToggleTab from '@/components/appearance-tabs';
import { useAppearance, useAppearancePageSync } from '@/hooks/use-appearance';
import { usePlatformCursorStyle } from '@/hooks/use-platform-cursors';
import { home } from '@/routes';
import { getAuthTheme, getAuthThemeStyle } from '@/theme/platform-theme';
import type { AuthThemePage } from '@/theme/platform-theme';
import {
    getPresentationBackgroundImage,
    getPublicPresentationPalette,
    getPublicPresentationStyle,
} from '@/theme/presentation';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { component, props } = usePage();
    useAppearancePageSync(Boolean(props.auth.user), props.appearance);
    const { resolvedAppearance } = useAppearance();
    const page = component.replace('auth/', '') as AuthThemePage;
    const backgroundImage = getPresentationBackgroundImage(
        props.publicPresentation,
        page,
        resolvedAppearance,
    );
    const publicPalette = getPublicPresentationPalette(
        props.publicPresentation,
        resolvedAppearance,
    );
    const theme = {
        ...getAuthTheme(page, resolvedAppearance),
        borderLineColor: publicPalette.controlBorder,
        buttonBackground: publicPalette.accentText,
        buttonTextColor: publicPalette.controlText,
        descriptionTextColor: publicPalette.bodyText,
        eyebrowTextColor: publicPalette.accentText,
        focusRingColor: publicPalette.accentText,
        inputBorderColor: publicPalette.controlBorder,
        labelTextColor: publicPalette.bodyText,
        linkTextColor: publicPalette.accentText,
        logoBackground: publicPalette.accentText,
        logoColor: publicPalette.controlText,
        titleTextColor: publicPalette.headingText,
        ...(backgroundImage ? { backgroundImage } : {}),
    };
    const cursorStyle = usePlatformCursorStyle(props.publicPresentation);
    const themeStyle = {
        ...getAuthThemeStyle(theme),
        ...getPublicPresentationStyle(
            props.publicPresentation,
            resolvedAppearance,
        ),
        ...cursorStyle,
    };

    return (
        <div
            className="platform-shell relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[var(--auth-background-color)] p-6 md:p-10"
            style={themeStyle}
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'var(--auth-background-image)' }}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--auth-background-overlay)' }}
            />
            <AppearanceToggleTab
                className="absolute top-4 right-4 z-10 shadow-lg"
                variant="subtle"
            />

            <div
                className="relative w-full max-w-sm rounded-lg border p-6 shadow-2xl backdrop-blur-md md:p-8"
                style={{
                    background: 'var(--auth-panel-background)',
                    borderColor: 'var(--auth-border-line-color)',
                }}
            >
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 font-medium"
                        >
                            <div
                                className="mb-1 flex h-10 w-10 items-center justify-center rounded-md"
                                style={{
                                    background: 'var(--auth-logo-background)',
                                    color: 'var(--auth-logo-color)',
                                }}
                            >
                                <AppLogoIcon className="size-6 fill-current" />
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{
                                    color: 'var(--auth-title-text-color)',
                                }}
                            >
                                {title}
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
