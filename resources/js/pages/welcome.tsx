import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Compass, LogIn } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import AppearanceToggleTab from '@/components/appearance-tabs';
import { platformInfoLinks } from '@/features/platform-info/content';
import { useAppearance, useAppearancePageSync } from '@/hooks/use-appearance';
import { login, register } from '@/routes';
import { platformCursorStyle } from '@/theme/cursors';
import { getAuthTheme, getAuthThemeStyle } from '@/theme/platform-theme';
import {
    getPublicPresentationStyle,
    getPresentationBackgroundImage,
    getWelcomePages,
} from '@/theme/presentation';

const worldHref = '/world';

export default function Welcome() {
    const { auth, appearance, publicPresentation } = usePage().props;
    useAppearancePageSync(Boolean(auth.user), appearance);
    const { resolvedAppearance } = useAppearance();
    const backgroundImage = getPresentationBackgroundImage(
        publicPresentation,
        'welcome',
        resolvedAppearance,
    );
    const theme = {
        ...getAuthTheme('welcome', resolvedAppearance),
        ...(backgroundImage ? { backgroundImage } : {}),
    };
    const themeStyle = {
        ...getAuthThemeStyle(theme),
        ...platformCursorStyle(publicPresentation),
        ...getPublicPresentationStyle(publicPresentation, resolvedAppearance),
    };
    const welcomePages = getWelcomePages(publicPresentation);
    const pageCount = welcomePages.length;
    const [activePage, setActivePage] = useState(0);
    const wheelLocked = useRef(false);

    const goToPage = useCallback(
        (pageIndex: number) => {
            setActivePage(Math.min(Math.max(pageIndex, 0), pageCount - 1));
        },
        [pageCount],
    );

    const handleWheel = useCallback(
        (event: React.WheelEvent<HTMLElement>) => {
            if (Math.abs(event.deltaY) < 24 || wheelLocked.current) {
                return;
            }

            wheelLocked.current = true;
            goToPage(activePage + (event.deltaY > 0 ? 1 : -1));
            window.setTimeout(() => {
                wheelLocked.current = false;
            }, 520);
        },
        [activePage, goToPage],
    );

    return (
        <>
            <Head title="Learning Worlds" />
            <main
                className="relative h-svh overflow-hidden bg-[var(--auth-background-color)]"
                onWheel={handleWheel}
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

                <header className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
                    <div className="flex items-center gap-3 text-sm font-semibold">
                        <span
                            className="flex size-9 items-center justify-center rounded-md"
                            style={{
                                background: 'var(--public-accent-text)',
                                color: 'var(--auth-logo-color)',
                            }}
                        >
                            <Compass className="size-5" />
                        </span>
                        <span style={{ color: 'var(--public-heading-text)' }}>
                            Learning Worlds
                        </span>
                    </div>

                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Link
                                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium opacity-95 transition hover:opacity-100"
                                href={worldHref}
                                style={{
                                    background: 'var(--public-accent-text)',
                                    color: 'var(--auth-button-text-color)',
                                }}
                            >
                                Open world
                                <ArrowRight className="size-4" />
                            </Link>
                        ) : (
                            <>
                                <AppearanceToggleTab
                                    className="mr-2 border-0 shadow-lg"
                                    variant="subtle"
                                />
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:bg-current/8"
                                    href={login()}
                                    style={{
                                        color: 'var(--public-control-text)',
                                    }}
                                >
                                    <LogIn className="size-4" />
                                    Log in
                                </Link>
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md bg-transparent px-4 py-2 text-sm font-medium opacity-95 transition hover:bg-current/8 hover:opacity-100"
                                    href={register()}
                                    style={{
                                        color: 'var(--public-control-text)',
                                    }}
                                >
                                    Register
                                    <ArrowRight className="size-4" />
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                {welcomePages.map((page, index) => (
                    <section
                        aria-hidden={activePage !== index}
                        className="absolute inset-0 z-10 flex items-center px-6 pb-20 transition-[opacity,transform] duration-500 ease-out md:px-10"
                        key={page.title}
                        style={{
                            opacity: activePage === index ? 1 : 0,
                            pointerEvents:
                                activePage === index ? 'auto' : 'none',
                            transform:
                                activePage === index
                                    ? 'translateY(0)'
                                    : `translateY(${activePage < index ? '28px' : '-28px'})`,
                        }}
                    >
                        <div className="max-w-3xl">
                            <p
                                className="mb-4 text-sm font-medium tracking-[0.18em] uppercase"
                                style={{
                                    color: 'var(--public-accent-text)',
                                }}
                            >
                                {page.eyebrow}
                            </p>
                            <h1
                                className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl"
                                style={{
                                    color: 'var(--public-heading-text)',
                                }}
                            >
                                {page.title}
                            </h1>
                            <p
                                className="mt-6 max-w-2xl text-base leading-8 md:text-lg"
                                style={{
                                    color: 'var(--public-body-text)',
                                }}
                            >
                                {page.body}
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold opacity-95 transition hover:opacity-100"
                                    href={
                                        index === 1
                                            ? '/about'
                                            : auth.user
                                              ? worldHref
                                              : register()
                                    }
                                    style={{
                                        background: 'var(--public-accent-text)',
                                        color: 'var(--auth-button-text-color)',
                                    }}
                                >
                                    {page.primaryLabel}
                                    <ArrowRight className="size-4" />
                                </Link>
                                {!auth.user && index === 0 ? (
                                    <Link
                                        className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
                                        href={login()}
                                        style={{
                                            borderColor:
                                                'var(--public-control-border)',
                                            color: 'var(--public-control-text)',
                                        }}
                                    >
                                        Continue learning
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </section>
                ))}

                <nav
                    aria-label="Welcome pages"
                    className="absolute top-1/2 right-5 z-20 flex -translate-y-1/2 flex-col gap-3"
                >
                    {welcomePages.map((page, index) => (
                        <button
                            aria-label={`Show ${page.title}`}
                            aria-current={activePage === index}
                            className="size-3 rounded-[3px] border transition"
                            key={page.title}
                            onClick={() => goToPage(index)}
                            style={{
                                background:
                                    activePage === index
                                        ? 'var(--public-accent-text)'
                                        : resolvedAppearance === 'light'
                                          ? 'rgba(255,255,255,0.82)'
                                          : 'rgba(15,23,42,0.82)',
                                borderColor:
                                    activePage === index
                                        ? 'var(--public-accent-text)'
                                        : 'var(--auth-border-line-color)',
                            }}
                            type="button"
                        />
                    ))}
                </nav>

                {!auth.user ? <PublicWelcomeFooter /> : null}
            </main>
        </>
    );
}

function PublicWelcomeFooter() {
    return (
        <footer className="absolute right-0 bottom-0 left-0 z-20 flex flex-wrap items-center justify-center gap-2 px-6 py-5 md:justify-end md:pr-20 md:pl-10">
            {platformInfoLinks.map((link) => (
                <Link
                    className="rounded-md px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                    href={link.href}
                    key={link.key}
                    style={{
                        color: 'var(--public-control-text)',
                    }}
                >
                    {link.label}
                </Link>
            ))}
        </footer>
    );
}
