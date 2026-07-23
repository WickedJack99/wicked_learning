import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    Building2,
    Crown,
    Plus,
    Save,
    Shuffle,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AccentHeading } from '@/components/accent-heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OrganizationIcon } from '@/features/organizations/organization-icon';
import type {
    OrganizationGovernanceType,
    OrganizationSummary,
} from '@/features/organizations/types';

type OrganizationForm = {
    description: string;
    governance_type: OrganizationGovernanceType;
    name: string;
    slogan: string;
};

const governanceOptions: {
    description: string;
    icon: typeof Crown;
    label: string;
    value: OrganizationGovernanceType;
}[] = [
    {
        description: 'Leaders stay in place until changed manually.',
        icon: Crown,
        label: 'Monarchy',
        value: 'monarchy',
    },
    {
        description: 'Every accepted member is a leader.',
        icon: Users,
        label: 'Anarchy',
        value: 'anarchy',
    },
    {
        description: 'One random member becomes leader each month.',
        icon: Shuffle,
        label: 'Random',
        value: 'random',
    },
];

const organizationAccentClass = 'text-[var(--map-floating-accent-color)]';
const organizationAccentBorderClass =
    'border-[var(--map-floating-accent-color)]';
const organizationAccentBackgroundClass =
    'bg-[color-mix(in_srgb,var(--map-floating-accent-color)_12%,transparent)]';

export default function OrganizationsIndex({
    organizations,
}: {
    organizations: OrganizationSummary[];
}) {
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState<OrganizationForm>({
        description: '',
        governance_type: 'monarchy',
        name: '',
        slogan: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    function createOrganization(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);

        router.post('/organizations', form, {
            onError: (nextErrors) => setErrors(nextErrors),
            onFinish: () => setSaving(false),
        });
    }

    return (
        <>
            <Head title="Organizations" />
            <main className="min-h-svh bg-slate-100 px-4 py-6 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto grid max-w-6xl gap-5">
                    <AccentHeading
                        action={
                            <Button
                                onClick={() => setIsCreating((open) => !open)}
                                type="button"
                            >
                                <Plus className="size-4" />
                                New organization
                            </Button>
                        }
                        eyebrow="Community"
                        title="Organizations"
                        description={
                            <>
                                Browse public learner organizations, request to
                                join, or create a space for your own project
                                community.
                            </>
                        }
                    />

                    {isCreating ? (
                        <form
                            className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#111820]"
                            onSubmit={createOrganization}
                        >
                            <div className="flex items-center gap-3">
                                <Building2
                                    className={`size-5 ${organizationAccentClass}`}
                                />
                                <h2 className="text-lg font-semibold">
                                    Create organization
                                </h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Name" message={errors.name}>
                                    <Input
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                name: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Slogan" message={errors.slogan}>
                                    <Input
                                        maxLength={180}
                                        value={form.slogan}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                slogan: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            <Field
                                label="Description"
                                message={errors.description}
                            >
                                <textarea
                                    className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                                    value={form.description}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            description: event.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <div className="grid gap-2">
                                <Label>Organization type</Label>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {governanceOptions.map((option) => {
                                        const Icon = option.icon;
                                        const selected =
                                            form.governance_type ===
                                            option.value;

                                        return (
                                            <label
                                                className={[
                                                    'grid cursor-pointer gap-2 rounded-lg border p-3 text-sm transition',
                                                    selected
                                                        ? `${organizationAccentBorderClass} ${organizationAccentBackgroundClass}`
                                                        : 'border-slate-200 bg-slate-50 hover:border-[color-mix(in_srgb,var(--map-floating-accent-color)_42%,transparent)] dark:border-white/10 dark:bg-white/5',
                                                ].join(' ')}
                                                key={option.value}
                                            >
                                                <input
                                                    checked={selected}
                                                    className="sr-only"
                                                    name="governance_type"
                                                    type="radio"
                                                    value={option.value}
                                                    onChange={() =>
                                                        setForm({
                                                            ...form,
                                                            governance_type:
                                                                option.value,
                                                        })
                                                    }
                                                />
                                                <span className="flex items-center gap-2 font-semibold">
                                                    <Icon
                                                        className={`size-4 ${organizationAccentClass}`}
                                                    />
                                                    {option.label}
                                                </span>
                                                <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    {option.description}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <InputError message={errors.governance_type} />
                            </div>
                            <InputError message={errors.organization} />
                            <div className="flex gap-2">
                                <Button disabled={saving} type="submit">
                                    <Save className="size-4" />
                                    Create
                                </Button>
                                <Button
                                    onClick={() => setIsCreating(false)}
                                    type="button"
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : null}

                    <section className="grid gap-3">
                        {organizations.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-[#111820] dark:text-slate-400">
                                No organizations exist yet.
                            </p>
                        ) : null}
                        {organizations.map((organization) => (
                            <article
                                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[5rem_minmax(0,1fr)_max-content] md:items-center dark:border-white/10 dark:bg-[#111820]"
                                key={organization.id}
                            >
                                <OrganizationIcon
                                    className="size-20"
                                    iconUrl={organization.iconUrl}
                                    name={organization.name}
                                />
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold">
                                        {organization.name}
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                        {organization.slogan ||
                                            'No slogan yet.'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {organization.memberCount} members ·{' '}
                                        {governanceLabel(
                                            organization.governanceType,
                                        )}
                                    </p>
                                </div>
                                <Button asChild>
                                    <Link
                                        href={`/organizations/${organization.slug}`}
                                    >
                                        View
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            </article>
                        ))}
                    </section>
                </div>
            </main>
        </>
    );
}

function Field({
    children,
    label,
    message,
}: {
    children: ReactNode;
    label: string;
    message?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={message} />
        </div>
    );
}

function governanceLabel(type: OrganizationGovernanceType): string {
    if (type === 'anarchy') {
        return 'Anarchy';
    }

    if (type === 'random') {
        return 'Random monthly leader';
    }

    return 'Monarchy';
}
