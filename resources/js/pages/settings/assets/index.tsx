import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Coins, Hammer, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AssetSection = {
    description: string;
    href: string | null;
    icon: typeof Hammer;
    label: string;
};

const sections: AssetSection[] = [
    {
        label: 'Tools',
        description: 'Create reusable learner tools for obstacle activities.',
        href: '/settings/assets/tools',
        icon: Hammer,
    },
    {
        label: 'Items',
        description: 'Create consumable inventory objects for item-based activities.',
        href: '/settings/assets/items',
        icon: Package,
    },
    {
        label: 'Currencies',
        description: 'Future non-pressure resource concepts, if ever needed.',
        href: null,
        icon: Coins,
    },
];

export default function AdminAssetsIndex() {
    return (
        <>
            <Head title="Tools, items and currencies" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-5xl flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href="/settings">
                                <ArrowLeft className="size-4" />
                                Settings
                            </Link>
                        </Button>
                        <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                            Administration
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Tools, items and currencies
                        </h1>
                    </header>

                    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                        <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
                            {sections.map((section) => (
                                <AssetSectionButton
                                    key={section.label}
                                    section={section}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function AssetSectionButton({ section }: { section: AssetSection }) {
    const Icon = section.icon;
    const content = (
        <>
            <span className="flex size-10 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-slate-950/70 dark:text-teal-200">
                <Icon className="size-5" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                    {section.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {section.description}
                </span>
            </span>
        </>
    );

    if (section.href) {
        return (
            <Link
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-500/35 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/8 dark:bg-white/5 dark:hover:border-teal-200/35 dark:hover:bg-teal-100/8 dark:focus-visible:ring-teal-200"
                href={section.href}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-left opacity-70 dark:border-white/8 dark:bg-white/4"
            disabled
            type="button"
        >
            {content}
        </button>
    );
}
