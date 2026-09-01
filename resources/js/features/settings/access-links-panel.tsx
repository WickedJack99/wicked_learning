import { router } from '@inertiajs/react';
import { Check, Clipboard, Link, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    AccessLinkOption,
    AccessLinkPurpose,
    AccessLinkSummary,
    AccessRoleSummary,
    UserRole,
} from './settings-access-types';

type Props = {
    accessLinkOptions: {
        items: AccessLinkOption[];
        tools: AccessLinkOption[];
    };
    accessLinks: AccessLinkSummary[];
    assignableRoles: UserRole[];
    canCreate: boolean;
    createdAccessLink: string | null;
    roles: AccessRoleSummary[];
};

type ItemGrant = { item_id: string; quantity: string };

const purposes: { label: string; value: AccessLinkPurpose }[] = [
    { label: 'Grant a tool', value: 'grant_tool' },
    { label: 'Grant items', value: 'grant_items' },
    { label: 'Allow registration', value: 'registration' },
    { label: 'Temporary learner login', value: 'temporary_login' },
];

export function AccessLinksPanel({
    accessLinkOptions,
    accessLinks,
    assignableRoles,
    canCreate,
    createdAccessLink,
    roles,
}: Props) {
    const t = usePlatformTranslation();
    const [purpose, setPurpose] = useState<AccessLinkPurpose>('grant_tool');
    const [expiresAt, setExpiresAt] = useState(defaultExpiry());
    const [note, setNote] = useState('');
    const [toolId, setToolId] = useState('');
    const [itemGrants, setItemGrants] = useState<ItemGrant[]>([
        { item_id: '', quantity: '1' },
    ]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([
        assignableRoles[0] ?? 'user',
    ]);
    const [copied, setCopied] = useState(false);

    const createLink = () => {
        router.post(
            '/settings/access-links',
            {
                purpose,
                expires_at: expiresAt,
                item_grants: purpose === 'grant_items' ? itemGrants : [],
                note: note.trim() || null,
                roles: purpose === 'registration' ? selectedRoles : [],
                tool_id: purpose === 'grant_tool' ? toolId : null,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const copyLink = async () => {
        if (!createdAccessLink) {
            return;
        }

        await navigator.clipboard.writeText(createdAccessLink);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div
            className="flex h-full min-h-0 flex-col overflow-hidden"
            data-wl-id="settings.access-links.panel"
        >
            <div
                className="shrink-0 border-b border-[var(--settings-border-color)] pb-5"
                data-wl-id="settings.access-links.header"
            >
                <div className="flex items-center gap-3 text-[var(--settings-accent)]">
                    <Link className="size-5" />
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                        {t('settings.access.links.title', 'Access links')}
                    </h2>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {t(
                        'settings.access.links.description',
                        'Create one-time, expiring links for a controlled grant, registration or temporary demonstration login.',
                    )}
                </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {createdAccessLink ? (
                    <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] p-4">
                        <p className="text-sm font-medium text-slate-950 dark:text-white">
                            {t('settings.access.links.created', 'New link')}
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-[var(--settings-content-background)] px-3 py-2 text-sm text-slate-950 dark:text-slate-50">
                                {createdAccessLink}
                            </code>
                            <Button onClick={copyLink} variant="secondary">
                                {copied ? (
                                    <Check className="size-4" />
                                ) : (
                                    <Clipboard className="size-4" />
                                )}
                                {copied
                                    ? t('common.copied', 'Copied')
                                    : t('common.copy', 'Copy')}
                            </Button>
                        </div>
                    </div>
                ) : null}

                <section
                    className="mt-5 rounded-lg border border-[var(--settings-border-color)] p-4"
                    data-wl-id="settings.access-links.create-form"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1 sm:col-span-2">
                            <Label htmlFor="access-link-purpose">
                                {t('settings.access.links.purpose', 'Purpose')}
                            </Label>
                            <select
                                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                                disabled={!canCreate}
                                id="access-link-purpose"
                                onChange={(event) =>
                                    setPurpose(
                                        event.currentTarget
                                            .value as AccessLinkPurpose,
                                    )
                                }
                                value={purpose}
                            >
                                {purposes.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {purpose === 'grant_tool' ? (
                            <div className="grid gap-1 sm:col-span-2">
                                <Label htmlFor="access-link-tool">
                                    {t('settings.access.links.tool', 'Tool')}
                                </Label>
                                <select
                                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                                    disabled={!canCreate}
                                    id="access-link-tool"
                                    onChange={(event) =>
                                        setToolId(event.currentTarget.value)
                                    }
                                    value={toolId}
                                >
                                    <option value="">Choose a tool</option>
                                    {accessLinkOptions.tools.map((tool) => (
                                        <option key={tool.id} value={tool.id}>
                                            {tool.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        {purpose === 'grant_items' ? (
                            <div className="grid gap-2 sm:col-span-2">
                                <Label>
                                    {t('settings.access.links.items', 'Items')}
                                </Label>
                                {itemGrants.map((grant, index) => (
                                    <div
                                        className="flex flex-col gap-2 sm:flex-row"
                                        key={index}
                                    >
                                        <select
                                            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                                            disabled={!canCreate}
                                            onChange={(event) =>
                                                updateItemGrant(
                                                    setItemGrants,
                                                    index,
                                                    'item_id',
                                                    event.currentTarget.value,
                                                )
                                            }
                                            value={grant.item_id}
                                        >
                                            <option value="">
                                                Choose an item
                                            </option>
                                            {accessLinkOptions.items.map(
                                                (item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.title}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                        <Input
                                            className="sm:w-28"
                                            disabled={!canCreate}
                                            min={1}
                                            onChange={(event) =>
                                                updateItemGrant(
                                                    setItemGrants,
                                                    index,
                                                    'quantity',
                                                    event.currentTarget.value,
                                                )
                                            }
                                            type="number"
                                            value={grant.quantity}
                                        />
                                        <Button
                                            aria-label="Remove item"
                                            disabled={
                                                !canCreate ||
                                                itemGrants.length === 1
                                            }
                                            onClick={() =>
                                                setItemGrants((current) =>
                                                    current.filter(
                                                        (_, itemIndex) =>
                                                            itemIndex !== index,
                                                    ),
                                                )
                                            }
                                            type="button"
                                            variant="secondary"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    className="w-fit"
                                    disabled={!canCreate}
                                    onClick={() =>
                                        setItemGrants((current) => [
                                            ...current,
                                            { item_id: '', quantity: '1' },
                                        ])
                                    }
                                    type="button"
                                    variant="secondary"
                                >
                                    <Plus className="size-4" />
                                    Add item
                                </Button>
                            </div>
                        ) : null}

                        {purpose === 'registration' ? (
                            <div className="grid gap-1 sm:col-span-2">
                                <Label htmlFor="access-link-roles">
                                    {t('settings.access.links.roles', 'Roles')}
                                </Label>
                                <select
                                    className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                    disabled={!canCreate}
                                    id="access-link-roles"
                                    multiple
                                    onChange={(event) =>
                                        setSelectedRoles(
                                            Array.from(
                                                event.currentTarget
                                                    .selectedOptions,
                                                (option) => option.value,
                                            ),
                                        )
                                    }
                                    value={selectedRoles}
                                >
                                    {roles
                                        .filter((role) =>
                                            assignableRoles.includes(role.slug),
                                        )
                                        .map((role) => (
                                            <option
                                                key={role.slug}
                                                value={role.slug}
                                            >
                                                {role.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        ) : null}

                        <div className="grid gap-1">
                            <Label htmlFor="access-link-expires-at">
                                {t(
                                    'settings.access.links.expires',
                                    'Expires at',
                                )}
                            </Label>
                            <Input
                                disabled={!canCreate}
                                id="access-link-expires-at"
                                onChange={(event) =>
                                    setExpiresAt(event.currentTarget.value)
                                }
                                required
                                type="datetime-local"
                                value={expiresAt}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="access-link-note">
                                {t('settings.access.links.note', 'Note')}
                            </Label>
                            <Input
                                disabled={!canCreate}
                                id="access-link-note"
                                maxLength={500}
                                onChange={(event) =>
                                    setNote(event.currentTarget.value)
                                }
                                placeholder="Optional internal note"
                                value={note}
                            />
                        </div>
                    </div>
                    <Button
                        data-wl-id="settings.access-links.create-submit"
                        className="mt-4"
                        disabled={!canCreate}
                        onClick={createLink}
                        type="button"
                    >
                        <Plus className="size-4" />
                        {t('settings.access.links.create', 'Create link')}
                    </Button>
                </section>

                <section
                    className="mt-5 rounded-lg border border-[var(--settings-border-color)] p-4"
                    data-wl-id="settings.access-links.recent-list"
                >
                    <h3 className="text-sm font-medium text-slate-950 dark:text-white">
                        {t('settings.access.links.recent', 'Recent links')}
                    </h3>
                    <div className="mt-3 grid gap-2">
                        {accessLinks.map((link) => (
                            <div
                                className="rounded-md bg-[var(--settings-active-background)] p-3 text-sm"
                                key={link.id}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {purposeLabel(link.purpose)}
                                    </span>
                                    <span className="text-xs text-[var(--settings-muted-text)]">
                                        {link.isExpired
                                            ? 'Expired'
                                            : link.isRedeemed
                                              ? 'Redeemed'
                                              : 'Available'}
                                    </span>
                                </div>
                                {link.note ? (
                                    <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                        {link.note}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                        {accessLinks.length === 0 ? (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                No links created yet.
                            </p>
                        ) : null}
                    </div>
                </section>
            </div>
        </div>
    );
}

function updateItemGrant(
    setItemGrants: Dispatch<SetStateAction<ItemGrant[]>>,
    index: number,
    key: keyof ItemGrant,
    value: string,
): void {
    setItemGrants((current) =>
        current.map((grant, grantIndex) =>
            grantIndex === index ? { ...grant, [key]: value } : grant,
        ),
    );
}

function purposeLabel(purpose: AccessLinkPurpose): string {
    return (
        purposes.find((option) => option.value === purpose)?.label ?? purpose
    );
}

function defaultExpiry(): string {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);

    return localDate.toISOString().slice(0, 16);
}
