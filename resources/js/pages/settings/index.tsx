import { Head } from '@inertiajs/react';
import {
    ArrowLeft,
    Bell,
    Brush,
    Database,
    Map,
    Shield,
    SlidersHorizontal,
    User,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type SettingsPanelKey =
    | 'admin-defaults'
    | 'admin-users'
    | 'admin-world'
    | 'appearance'
    | 'notifications'
    | 'profile'
    | 'security';

const settingsSections: Array<{
    items: Array<{
        description: string;
        icon: typeof User;
        key: SettingsPanelKey;
        label: string;
    }>;
    label: string;
}> = [
    {
        label: 'Personal',
        items: [
            {
                key: 'profile',
                label: 'Profile',
                description: 'Name, email and personal account details.',
                icon: User,
            },
            {
                key: 'security',
                label: 'Security',
                description: 'Password, passkeys and two-factor settings.',
                icon: Shield,
            },
            {
                key: 'appearance',
                label: 'Appearance',
                description: 'Theme preference and visual comfort options.',
                icon: Brush,
            },
            {
                key: 'notifications',
                label: 'Notifications',
                description: 'Future reminders, nudges and quiet hours.',
                icon: Bell,
            },
        ],
    },
    {
        label: 'Administration',
        items: [
            {
                key: 'admin-world',
                label: 'World content',
                description: 'Maps, nodes, activities and portals.',
                icon: Map,
            },
            {
                key: 'admin-users',
                label: 'Users',
                description: 'Learners, roles and access later on.',
                icon: Users,
            },
            {
                key: 'admin-defaults',
                label: 'Defaults',
                description: 'Theme, learning policy and platform defaults.',
                icon: SlidersHorizontal,
            },
        ],
    },
];

const panelContent: Record<
    SettingsPanelKey,
    {
        body: string;
        title: string;
    }
> = {
    profile: {
        title: 'Profile',
        body: 'This will connect to the existing profile settings while keeping account management inside the platform shell.',
    },
    security: {
        title: 'Security',
        body: 'Password, passkeys and two-factor controls can move here without relying on a separate sidebar-heavy screen.',
    },
    appearance: {
        title: 'Appearance',
        body: 'Theme preference, reduced motion and future cursor/theme packs belong here.',
    },
    notifications: {
        title: 'Notifications',
        body: 'Future reminders should support learner autonomy, quiet hours and wellbeing instead of pressure loops.',
    },
    'admin-world': {
        title: 'World content',
        body: 'First admin target: create and edit maps, hex nodes, activity graphs, dialogue stages, questions and portals.',
    },
    'admin-users': {
        title: 'Users',
        body: 'A later admin panel for roles and access. This should stay privacy-aware and avoid ranking learners.',
    },
    'admin-defaults': {
        title: 'Defaults',
        body: 'Platform defaults can define theme assets, hover colors, map behavior and learning-design policies.',
    },
};

export default function SettingsIndex() {
    const [selectedPanel, setSelectedPanel] = useState<SettingsPanelKey | null>(
        null,
    );

    return (
        <>
            <Head title="Settings" />
            <main className="h-full overflow-hidden bg-[#0b1117] text-slate-100">
                <div className="mx-auto flex h-full max-w-4xl flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        <p className="text-xs font-medium tracking-[0.18em] text-teal-200/70 uppercase">
                            Platform
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Settings
                        </h1>
                    </header>

                    <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#111820] shadow-2xl">
                        {selectedPanel ? (
                            <SettingsDetail
                                onBack={() => setSelectedPanel(null)}
                                selectedPanel={selectedPanel}
                            />
                        ) : (
                            <SettingsList onSelect={setSelectedPanel} />
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}

SettingsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Settings',
            href: '/settings',
        },
    ],
};

function SettingsList({
    onSelect,
}: {
    onSelect: (panel: SettingsPanelKey) => void;
}) {
    return (
        <div className="h-full overflow-y-auto p-4">
            {settingsSections.map((section) => (
                <section className="mb-6" key={section.label}>
                    <h2 className="mb-2 px-2 text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">
                        {section.label}
                    </h2>
                    <div className="grid gap-2">
                        {section.items.map((item) => {
                            const Icon = item.icon;

                            return (
                                <button
                                    className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/5 p-3 text-left transition hover:border-teal-200/35 hover:bg-teal-100/8 focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:outline-none"
                                    key={item.key}
                                    onClick={() => onSelect(item.key)}
                                    type="button"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-950/60 text-teal-200">
                                        <Icon className="size-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-white">
                                            {item.label}
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-400">
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function SettingsDetail({
    onBack,
    selectedPanel,
}: {
    onBack: () => void;
    selectedPanel: SettingsPanelKey | null;
}) {
    const content = selectedPanel ? panelContent[selectedPanel] : null;

    return (
        <div className="h-full overflow-y-auto bg-[#111820] p-4">
            <Button className="mb-5" onClick={onBack} variant="ghost">
                <ArrowLeft className="size-4" />
                Settings
            </Button>

            {content ? (
                <div className="rounded-lg border border-white/10 bg-white/6 p-5">
                    <div className="mb-4 flex items-center gap-3 text-teal-100">
                        <Database className="size-5" />
                        <h2 className="text-lg font-semibold text-white">
                            {content.title}
                        </h2>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                        {content.body}
                    </p>
                    <div className="mt-5 rounded-md border border-dashed border-white/15 p-4 text-sm leading-6 text-slate-400">
                        This is a scaffolded admin/settings panel. The next step
                        can connect these panels to real forms and policies.
                    </div>
                </div>
            ) : null}
        </div>
    );
}
