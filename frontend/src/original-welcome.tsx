import { ArrowRight, Compass, LogIn, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

type WelcomePage = {
    eyebrow: string;
    title: string;
    body: string;
    buttons: Array<{ text: string; target: string }>;
};

const defaultWelcomePages: WelcomePage[] = [
    {
        eyebrow: 'Explorable learning platform',
        title: 'Learning Worlds',
        body: 'A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.',
        buttons: [
            { text: 'Enter the first world', target: '/world' },
            { text: 'Continue learning', target: '/login' },
        ],
    },
    {
        eyebrow: 'Self-Determination Theory',
        title: 'Motivation without pressure loops',
        body: 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
        buttons: [{ text: 'Read about the concept', target: '/about' }],
    },
    {
        eyebrow: 'Configurable worlds',
        title: 'One learning model, many stories',
        body: 'A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
        buttons: [{ text: 'Explore the first map', target: '/world' }],
    },
];

export function OriginalWelcomePage({
    isAuthenticated,
}: {
    isAuthenticated: boolean;
}) {
    const [activePage, setActivePage] = useState(0);
    const [isLight, setIsLight] = useState(false);
    const activeWelcomePage =
        defaultWelcomePages[activePage] ?? defaultWelcomePages[0];
    const foreground = isLight ? '#0f172a' : '#f8fafc';
    const body = isLight
        ? 'rgba(51, 65, 85, 0.78)'
        : 'rgba(203, 213, 225, 0.78)';
    const accent = isLight ? '#0e7490' : '#5eead4';
    const controlText = isLight ? '#ffffff' : '#06111f';

    return (
        <main
            data-wl-id="public.welcome"
            className="relative h-svh overflow-hidden bg-[var(--auth-background-color)]"
            style={
                {
                    '--auth-background-color': isLight ? '#ecfeff' : '#07111f',
                    '--public-welcome-overlay': isLight
                        ? 'linear-gradient(120deg, rgba(236, 254, 255, 0.94), rgba(240, 249, 255, 0.82), rgba(219, 234, 254, 0.62))'
                        : 'linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))',
                } as React.CSSProperties
            }
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--public-welcome-overlay)' }}
            />
            <header className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
                <div className="flex items-center gap-3 text-sm font-semibold">
                    <span
                        className="flex size-9 items-center justify-center rounded-md"
                        style={{ background: accent, color: controlText }}
                    >
                        <Compass className="size-5" />
                    </span>
                    <span style={{ color: foreground }}>Learning Worlds</span>
                </div>
                <nav className="flex items-center gap-2">
                    <button
                        aria-label="Toggle colour appearance"
                        className="mr-2 inline-flex size-9 items-center justify-center rounded-md border-0 bg-white/10 p-0 shadow-lg hover:bg-white/20"
                        onClick={() => setIsLight((value) => !value)}
                        style={{ color: foreground }}
                        type="button"
                    >
                        {isLight ? (
                            <Moon className="size-4" />
                        ) : (
                            <Sun className="size-4" />
                        )}
                    </button>
                    {isAuthenticated ? (
                        <Link
                            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium opacity-95 transition hover:opacity-100"
                            style={{ background: accent, color: controlText }}
                            to="/account"
                        >
                            Open learning desk <ArrowRight className="size-4" />
                        </Link>
                    ) : (
                        <>
                            <Link
                                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:bg-current/8"
                                style={{ color: foreground }}
                                to="/login"
                            >
                                <LogIn className="size-4" /> Log in
                            </Link>
                            <span
                                aria-disabled="true"
                                className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-transparent px-4 py-2 text-sm font-medium opacity-60"
                                style={{ color: foreground }}
                                title="Registration is not available in the Rust proof of concept yet."
                            >
                                Register <ArrowRight className="size-4" />
                            </span>
                        </>
                    )}
                </nav>
            </header>
            {defaultWelcomePages.map((page, index) => (
                <section
                    aria-hidden={activePage !== index}
                    className="absolute inset-0 z-10 flex items-center px-6 pb-20 transition-[opacity,transform] duration-500 ease-out md:px-10"
                    key={page.title}
                    style={{
                        opacity: activePage === index ? 1 : 0,
                        pointerEvents: activePage === index ? 'auto' : 'none',
                        transform:
                            activePage === index
                                ? 'translateY(0)'
                                : `translateY(${activePage < index ? '28px' : '-28px'})`,
                    }}
                >
                    <div className="max-w-3xl">
                        <p
                            className="mb-4 text-sm font-medium tracking-[0.18em] uppercase"
                            style={{ color: accent }}
                        >
                            {page.eyebrow}
                        </p>
                        <h1
                            className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl"
                            style={{ color: foreground }}
                        >
                            {page.title}
                        </h1>
                        <p
                            className="mt-6 max-w-2xl text-base leading-8 md:text-lg"
                            style={{ color: body }}
                        >
                            {page.body}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            {page.buttons.map((button) => (
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold opacity-95 transition hover:opacity-100"
                                    key={`${button.text}-${button.target}`}
                                    style={{
                                        background: accent,
                                        color: controlText,
                                    }}
                                    to={button.target}
                                >
                                    {button.text}
                                    <ArrowRight className="size-4" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
            <nav
                aria-label="Welcome pages"
                className="absolute top-1/2 right-5 z-20 flex -translate-y-1/2 flex-col gap-3"
            >
                {defaultWelcomePages.map((page, index) => (
                    <button
                        aria-current={activePage === index}
                        aria-label={`Show ${page.title}`}
                        className="size-3 rounded-[3px] border p-0 transition"
                        key={page.title}
                        onClick={() => setActivePage(index)}
                        style={{
                            background:
                                activePage === index
                                    ? accent
                                    : isLight
                                      ? 'rgba(255,255,255,0.82)'
                                      : 'rgba(15,23,42,0.82)',
                            borderColor:
                                activePage === index
                                    ? accent
                                    : 'rgba(94,234,212,0.24)',
                        }}
                        type="button"
                    />
                ))}
            </nav>
            <footer className="absolute right-0 bottom-0 left-0 z-20 flex flex-wrap items-center justify-center gap-2 px-6 py-5 md:justify-end md:pr-20 md:pl-10">
                {['About', 'Imprint', 'Data protection'].map((label) => (
                    <Link
                        className="rounded-md px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                        key={label}
                        style={{ color: foreground }}
                        to={`/${label.toLowerCase().replace(' ', '-')}`}
                    >
                        {label}
                    </Link>
                ))}
            </footer>
        </main>
    );
}
