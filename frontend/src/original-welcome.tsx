import { ArrowRight, Compass, LogIn } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';

import { OriginalAppearanceToggle } from './original-appearance-toggle';
import {
    publicPresentationStyle,
    type PublicPresentation,
    welcomeBackgroundImage,
} from './public-presentation';

export function OriginalWelcomePage({
    isAuthenticated,
    presentation,
}: {
    isAuthenticated: boolean;
    presentation: PublicPresentation;
}) {
    const [activePage, setActivePage] = useState(0);
    const [isLight, setIsLight] = useState(false);
    const wheelLocked = useRef(false);
    const appearance = isLight ? 'light' : 'dark';
    const welcomePages = presentation.welcome.pages;
    const activeWelcomePage = welcomePages[activePage] ?? welcomePages[0];
    const backgroundImage = activeWelcomePage
        ? welcomeBackgroundImage(presentation, appearance, activeWelcomePage)
        : null;

    const goToPage = useCallback((pageIndex: number) => {
        setActivePage(
            Math.min(
                Math.max(pageIndex, 0),
                welcomePages.length - 1,
            ),
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
        <main
            data-wl-id="public.welcome"
            className="relative h-svh overflow-hidden bg-[var(--auth-background-color)]"
            onWheel={handleWheel}
            style={publicPresentationStyle(presentation, appearance, 'welcome')}
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: backgroundImage
                        ? `url(${backgroundImage})`
                        : 'var(--auth-background-image)',
                }}
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
                        style={{
                            background: 'var(--public-accent)',
                            color: 'var(--public-control-text)',
                        }}
                    >
                        <Compass className="size-5" />
                    </span>
                    <span style={{ color: 'var(--public-heading-text)' }}>
                        Learning Worlds
                    </span>
                </div>
                <nav className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <Link
                            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium opacity-95 transition hover:opacity-100"
                            style={{
                                background: 'var(--public-accent)',
                                color: 'var(--public-control-text)',
                            }}
                            to="/world"
                        >
                            Open learning desk <ArrowRight className="size-4" />
                        </Link>
                    ) : (
                        <>
                            <OriginalAppearanceToggle
                                appearance={isLight ? 'light' : 'dark'}
                                onAppearanceChange={(appearance) =>
                                    setIsLight(appearance === 'light')
                                }
                            />
                            <Link
                                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:bg-current/8"
                                style={{ color: 'var(--public-control-text)' }}
                                to="/login"
                            >
                                <LogIn className="size-4" /> Log in
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
                            style={{ color: 'var(--public-accent)' }}
                        >
                            {page.eyebrow}
                        </p>
                        <h1
                            className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl"
                            style={{ color: 'var(--public-heading-text)' }}
                        >
                            {page.title}
                        </h1>
                        <p
                            className="mt-6 max-w-2xl text-base leading-8 md:text-lg"
                            style={{ color: 'var(--public-body-text)' }}
                        >
                            {page.body}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            {page.buttons.map((button) => (
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold opacity-95 transition hover:opacity-100"
                                    key={`${button.text}-${button.target}`}
                                    style={{
                                        background: 'var(--public-accent)',
                                        color: 'var(--public-control-text)',
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
                {welcomePages.map((page, index) => (
                    <button
                        aria-current={activePage === index}
                        aria-label={`Show ${page.title}`}
                        className="size-3 rounded-[3px] border p-0 transition"
                        key={page.title}
                        onClick={() => setActivePage(index)}
                        style={{
                            background:
                                activePage === index
                                    ? 'var(--public-accent)'
                                    : isLight
                                      ? 'rgba(255,255,255,0.82)'
                                      : 'rgba(15,23,42,0.82)',
                            borderColor:
                                activePage === index
                                    ? 'var(--public-accent)'
                                    : 'var(--auth-border-line-color)',
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
                        style={{ color: 'var(--public-control-text)' }}
                        to={`/${label.toLowerCase().replace(' ', '-')}`}
                    >
                        {label}
                    </Link>
                ))}
            </footer>
        </main>
    );
}
