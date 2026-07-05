import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Compass, LogIn } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import AppearanceToggleTab from '@/components/appearance-tabs';
import { platformInfoLinks } from '@/features/platform-info/content';
import { useAppearance, useAppearancePageSync } from '@/hooks/use-appearance';
import { login, register } from '@/routes';
import { getAuthTheme, getAuthThemeStyle } from '@/theme/platform-theme';

const worldHref = '/world';

const welcomePages = [
    {
        eyebrow: 'Explorable learning platform',
        title: 'Learning Worlds',
        body: 'A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.',
        primaryLabel: 'Enter the first world',
    },
    {
        eyebrow: 'Self-Determination Theory',
        title: 'Motivation without pressure loops',
        body: 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
        primaryLabel: 'Read about the concept',
    },
    {
        eyebrow: 'Configurable worlds',
        title: 'One learning model, many stories',
        body: 'A world can look like a cyber network, a medieval map, an astronomy field or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
        primaryLabel: 'Explore the first map',
    },
];

export default function Welcome() {
    const { auth, appearance } = usePage().props;
    useAppearancePageSync(Boolean(auth.user), appearance);
    const { resolvedAppearance } = useAppearance();
    const theme = getAuthTheme('welcome', resolvedAppearance);
    const themeStyle = getAuthThemeStyle(theme);
    const [activePage, setActivePage] = useState(0);
    const wheelLocked = useRef(false);

    const goToPage = useCallback((pageIndex: number) => {
        setActivePage(
            Math.min(Math.max(pageIndex, 0), welcomePages.length - 1),
        );
    }, []);

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
                                background: 'var(--auth-logo-background)',
                                color: 'var(--auth-logo-color)',
                            }}
                        >
                            <Compass className="size-5" />
                        </span>
                        <span style={{ color: 'var(--auth-title-text-color)' }}>
                            Learning Worlds
                        </span>
                    </div>

                    <nav className="flex items-center gap-2">
                        <Link
                            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                            href="/about"
                            style={{
                                color: 'var(--auth-title-text-color)',
                            }}
                        >
                            About
                        </Link>
                        {auth.user ? (
                            <Link
                                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium opacity-95 transition hover:opacity-100"
                                href={worldHref}
                                style={{
                                    background: 'var(--auth-button-background)',
                                    color: 'var(--auth-button-text-color)',
                                }}
                            >
                                Open world
                                <ArrowRight className="size-4" />
                            </Link>
                        ) : (
                            <>
                                <AppearanceToggleTab className="mr-2 shadow-lg" />
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                                    href={login()}
                                    style={{
                                        color: 'var(--auth-title-text-color)',
                                    }}
                                >
                                    <LogIn className="size-4" />
                                    Log in
                                </Link>
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium opacity-95 transition hover:opacity-100"
                                    href={register()}
                                    style={{
                                        background:
                                            'var(--auth-button-background)',
                                        color: 'var(--auth-button-text-color)',
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
                                    color: 'var(--auth-eyebrow-text-color)',
                                }}
                            >
                                {page.eyebrow}
                            </p>
                            <h1
                                className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl"
                                style={{
                                    color: 'var(--auth-title-text-color)',
                                }}
                            >
                                {page.title}
                            </h1>
                            <p
                                className="mt-6 max-w-2xl text-base leading-8 md:text-lg"
                                style={{
                                    color: 'var(--auth-description-text-color)',
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
                                        background:
                                            'var(--auth-button-background)',
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
                                                'var(--auth-border-line-color)',
                                            color: 'var(--auth-title-text-color)',
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
                                        ? 'var(--auth-button-background)'
                                        : resolvedAppearance === 'light'
                                          ? 'rgba(255,255,255,0.82)'
                                          : 'rgba(15,23,42,0.82)',
                                borderColor:
                                    activePage === index
                                        ? 'var(--auth-button-background)'
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
        <footer className="absolute right-0 bottom-0 left-0 z-20 flex flex-wrap items-center justify-center gap-2 px-6 py-5 md:justify-end md:px-10">
            {platformInfoLinks.map((link) => (
                <Link
                    className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                    href={link.href}
                    key={link.key}
                    style={{
                        borderColor: 'var(--auth-border-line-color)',
                        color: 'var(--auth-title-text-color)',
                    }}
                >
                    {link.label}
                </Link>
            ))}
        </footer>
    );
}
