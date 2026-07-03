import { Link, usePage } from '@inertiajs/react';
import { Cog, Map, PlayCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type ActiveActivity = {
    activityId: number;
    activityTitle: string;
    nodeSlug?: string;
    nodeTitle: string;
    worldHref?: string;
};

const activeActivityStorageKey = 'learning.activeActivity';
const worldHref = '/world';

export function AppBottomNav() {
    const { url } = usePage();
    const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(
        null,
    );

    useEffect(() => {
        const readActiveActivity = () => {
            const stored = window.localStorage.getItem(
                activeActivityStorageKey,
            );
            setActiveActivity(
                stored ? (JSON.parse(stored) as ActiveActivity) : null,
            );
        };

        readActiveActivity();
        window.addEventListener(
            'learning:active-activity-changed',
            readActiveActivity,
        );
        window.addEventListener('storage', readActiveActivity);

        return () => {
            window.removeEventListener(
                'learning:active-activity-changed',
                readActiveActivity,
            );
            window.removeEventListener('storage', readActiveActivity);
        };
    }, []);

    const isMapActive = useMemo(
        () => url.startsWith('/world') || url.startsWith('/dashboard'),
        [url],
    );
    const isSettingsActive = useMemo(() => url.startsWith('/settings'), [url]);

    return (
        <nav className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/12 bg-slate-950/82 p-1.5 shadow-2xl shadow-black/35 backdrop-blur-md">
            {activeActivity ? (
                <FloatingNavLink
                    active={false}
                    href={activeActivity.worldHref ?? worldHref}
                    label={`Return to ${activeActivity.activityTitle}`}
                >
                    <PlayCircle className="size-5" />
                </FloatingNavLink>
            ) : null}

            <FloatingNavLink active={isMapActive} href={worldHref} label="Map">
                <Map className="size-5" />
            </FloatingNavLink>

            <FloatingNavLink
                active={isSettingsActive}
                href="/settings"
                label="Settings"
            >
                <Cog className="size-5" />
            </FloatingNavLink>
        </nav>
    );
}

function FloatingNavLink({
    active,
    children,
    href,
    label,
}: {
    active: boolean;
    children: React.ReactNode;
    href: string;
    label: string;
}) {
    return (
        <Link
            aria-label={label}
            className={cn(
                'flex size-11 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:outline-none',
                active &&
                    'bg-teal-300 text-slate-950 hover:bg-teal-200 hover:text-slate-950',
            )}
            href={href}
        >
            {children}
        </Link>
    );
}
