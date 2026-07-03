import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Compass, LogIn } from 'lucide-react';
import { login, register } from '@/routes';

const worldHref = '/world';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Learning Worlds" />
            <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage:
                            'url(/images/themes/cyber-map-background.svg)',
                    }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,31,0.92),rgba(7,17,31,0.62),rgba(7,17,31,0.28))]" />

                <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
                    <div className="flex items-center gap-3 text-sm font-semibold">
                        <span className="flex size-9 items-center justify-center rounded-md bg-teal-300 text-slate-950">
                            <Compass className="size-5" />
                        </span>
                        <span>Learning Worlds</span>
                    </div>

                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Link
                                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-100"
                                href={worldHref}
                            >
                                Open world
                                <ArrowRight className="size-4" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                                    href={login()}
                                >
                                    <LogIn className="size-4" />
                                    Log in
                                </Link>
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-100"
                                    href={register()}
                                >
                                    Register
                                    <ArrowRight className="size-4" />
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <section className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center px-6 pb-20 md:px-10">
                    <div className="max-w-3xl">
                        <p className="mb-4 text-sm font-medium tracking-[0.18em] text-teal-200 uppercase">
                            Explorable learning platform
                        </p>
                        <h1 className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl">
                            Learning Worlds
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
                            A first slice of a domain-agnostic learning
                            environment built around exploration, dialogue,
                            reflection and useful feedback instead of points,
                            streaks or leaderboards.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                className="inline-flex items-center gap-2 rounded-md bg-teal-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200"
                                href={auth.user ? worldHref : register()}
                            >
                                Enter the first world
                                <ArrowRight className="size-4" />
                            </Link>
                            {!auth.user ? (
                                <Link
                                    className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                    href={login()}
                                >
                                    Continue learning
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}
