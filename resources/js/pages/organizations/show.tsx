import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    EyeOff,
    Flag,
    LogOut,
    MessageSquareText,
    Save,
    Send,
    SlidersHorizontal,
    Trash2,
    Upload,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import {
    SettingsSectionNavigation,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMessageTime } from '@/features/messages/message-time';
import { OrganizationIcon } from '@/features/organizations/organization-icon';
import type {
    OrganizationDetail,
    OrganizationJoinRequest,
} from '@/features/organizations/types';
import { uploadMediaFile } from '@/lib/media-upload';

type OrganizationForm = {
    description: string;
    name: string;
    slogan: string;
};

type OrganizationSection =
    | 'leader-controls'
    | 'chat'
    | 'membership'
    | 'join-requests'
    | 'members'
    | 'report-icon';

export default function OrganizationShow({
    organization,
}: {
    organization: OrganizationDetail;
}) {
    const isMember = Boolean(organization.viewerMembership);
    const canViewChat = isMember || organization.canModerateMessages;
    const leaderCount = organization.members.filter(
        (member) => member.role === 'leader',
    ).length;
    const isOnlyLeader =
        organization.viewerMembership?.role === 'leader' && leaderCount <= 1;
    const canLeave =
        !isOnlyLeader ||
        (organization.governanceType === 'random' &&
            organization.memberCount > 1);
    const defaultSection: OrganizationSection = organization.isLeader
        ? 'leader-controls'
        : canViewChat
          ? 'chat'
          : 'membership';
    const [form, setForm] = useState<OrganizationForm>({
        description: organization.description ?? '',
        name: organization.name,
        slogan: organization.slogan ?? '',
    });
    const [joinMessage, setJoinMessage] = useState('');
    const [chatBody, setChatBody] = useState('');
    const [reportReason, setReportReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState(false);
    const [selectedSection, setSelectedSection] =
        useState<OrganizationSection>(defaultSection);
    const sectionItems = getOrganizationSectionItems({
        canReportIcon: Boolean(organization.iconUrl) && !organization.isLeader,
        isLeader: organization.isLeader,
        canViewChat,
        joinRequestCount: organization.joinRequests.length,
        memberCount: organization.memberCount,
    });
    const activeSection = sectionItems.some(
        (item) => item.key === selectedSection,
    )
        ? selectedSection
        : defaultSection;
    const contentPaneClassName =
        activeSection === 'chat' && canViewChat
            ? 'grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden pr-1'
            : 'grid min-w-0 content-start gap-5 overflow-y-auto pr-1';

    function updateOrganization(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.patch(`/organizations/${organization.slug}`, form, {
            preserveScroll: true,
            onError: (nextErrors) => setErrors(nextErrors),
            onSuccess: () => setErrors({}),
        });
    }

    async function uploadIcon(file: File) {
        setUploading(true);

        try {
            await uploadMediaFile({
                endpoint: `/organizations/${organization.slug}/icon`,
                file,
            });
            router.reload({ only: ['organization'] });
        } catch (error) {
            setErrors({
                icon:
                    error instanceof Error
                        ? error.message
                        : 'The icon could not be uploaded.',
            });
        } finally {
            setUploading(false);
        }
    }

    function requestJoin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post(
            `/organizations/${organization.slug}/join-requests`,
            { message: joinMessage },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setJoinMessage(''),
            },
        );
    }

    function leaveOrganization() {
        router.delete(`/organizations/${organization.slug}/membership`, {
            preserveScroll: true,
            onError: (nextErrors) => setErrors(nextErrors),
            onSuccess: () => setErrors({}),
        });
    }

    function promoteMember(membershipId: number) {
        router.patch(
            `/organization-memberships/${membershipId}/leader`,
            {},
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setErrors({}),
            },
        );
    }

    function deleteOrganization() {
        if (!window.confirm(`Delete ${organization.name}?`)) {
            return;
        }

        router.delete(`/organizations/${organization.slug}`);
    }

    function sendMessage(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post(
            `/organizations/${organization.slug}/messages`,
            { body: chatBody },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    setChatBody('');
                    setErrors({});
                },
            },
        );
    }

    function deleteMessage(messageId: number) {
        router.delete(`/organization-messages/${messageId}`, {
            preserveScroll: true,
            onError: (nextErrors) => setErrors(nextErrors),
            onSuccess: () => setErrors({}),
        });
    }

    function hideMessage(messageId: number) {
        router.patch(
            `/organization-messages/${messageId}/hide`,
            {},
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setErrors({}),
            },
        );
    }

    function reportIcon(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post(
            `/organizations/${organization.slug}/icon-reports`,
            { reason: reportReason },
            {
                preserveScroll: true,
                onSuccess: () => setReportReason(''),
            },
        );
    }

    return (
        <>
            <Head title={organization.name} />
            <main className="fixed inset-0 overflow-hidden bg-slate-100 px-4 pt-5 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full min-h-0 w-full max-w-[92rem] flex-col overflow-hidden">
                    <div className="shrink-0 pb-5">
                        <Button asChild className="w-max" variant="ghost">
                            <Link href="/organizations">
                                <ArrowLeft className="size-4" />
                                Organizations
                            </Link>
                        </Button>
                    </div>

                    <section className="grid min-h-0 flex-1 gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:grid-cols-[16rem_minmax(0,1fr)] dark:border-white/10 dark:bg-[#111820]">
                        <SettingsSidebar>
                            <SettingsSectionNavigation
                                activeSection={activeSection}
                                ariaLabel="Organization sections"
                                items={sectionItems}
                                onChange={setSelectedSection}
                            />
                        </SettingsSidebar>

                        <div className={contentPaneClassName}>
                            <OrganizationSummary organization={organization} />

                            {activeSection === 'leader-controls' &&
                            organization.isLeader ? (
                                <LeaderPanel
                                    errors={errors}
                                    form={form}
                                    onDelete={deleteOrganization}
                                    onFormChange={setForm}
                                    onSubmit={updateOrganization}
                                    onUpload={uploadIcon}
                                    uploading={uploading}
                                />
                            ) : null}

                            {activeSection === 'chat' && canViewChat ? (
                                <ChatPanel
                                    body={chatBody}
                                    error={errors.body}
                                    messages={organization.messages}
                                    showComposer={organization.canSendMessages}
                                    onBodyChange={setChatBody}
                                    onDeleteMessage={deleteMessage}
                                    onHideMessage={hideMessage}
                                    onSubmit={sendMessage}
                                />
                            ) : null}

                            {activeSection === 'membership' ? (
                                <MembershipPanel
                                    canLeave={canLeave}
                                    errors={errors}
                                    isMember={isMember}
                                    joinMessage={joinMessage}
                                    joinRequestStatus={
                                        organization.viewerJoinRequest
                                            ?.status ?? null
                                    }
                                    onJoinMessageChange={setJoinMessage}
                                    onLeave={leaveOrganization}
                                    onOpenLeaderControls={() =>
                                        setSelectedSection('leader-controls')
                                    }
                                    onRequestJoin={requestJoin}
                                />
                            ) : null}

                            {activeSection === 'join-requests' &&
                            organization.isLeader ? (
                                <JoinRequestPanel
                                    requests={organization.joinRequests}
                                />
                            ) : null}

                            {activeSection === 'members' ? (
                                <MemberList
                                    canPromote={
                                        organization.isLeader &&
                                        organization.governanceType ===
                                            'monarchy'
                                    }
                                    errors={errors}
                                    members={organization.members}
                                    onPromote={promoteMember}
                                />
                            ) : null}

                            {activeSection === 'report-icon' &&
                            organization.iconUrl &&
                            !organization.isLeader ? (
                                <ReportIconPanel
                                    error={errors.icon}
                                    onReasonChange={setReportReason}
                                    onSubmit={reportIcon}
                                    reason={reportReason}
                                />
                            ) : null}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function getOrganizationSectionItems({
    canViewChat,
    canReportIcon,
    isLeader,
    joinRequestCount,
    memberCount,
}: {
    canViewChat: boolean;
    canReportIcon: boolean;
    isLeader: boolean;
    joinRequestCount: number;
    memberCount: number;
}): SettingsNavigationItem<OrganizationSection>[] {
    return [
        ...(isLeader
            ? [
                  {
                      description: 'Edit details, icon, and ownership actions.',
                      icon: SlidersHorizontal,
                      key: 'leader-controls',
                      label: 'Leader controls',
                  } satisfies SettingsNavigationItem<OrganizationSection>,
              ]
            : []),
        ...(canViewChat
            ? [
                  {
                      description: 'Shared member conversation.',
                      icon: MessageSquareText,
                      key: 'chat',
                      label: 'Chat',
                  } satisfies SettingsNavigationItem<OrganizationSection>,
              ]
            : []),
        {
            description: 'Join or leave this organization.',
            icon: LogOut,
            key: 'membership',
            label: 'Membership',
        },
        ...(isLeader
            ? [
                  {
                      description: `${joinRequestCount} pending request${joinRequestCount === 1 ? '' : 's'}.`,
                      icon: UserPlus,
                      key: 'join-requests',
                      label: 'Join requests',
                  } satisfies SettingsNavigationItem<OrganizationSection>,
              ]
            : []),
        {
            description: `${memberCount} member${memberCount === 1 ? '' : 's'}.`,
            icon: Users,
            key: 'members',
            label: 'Members',
        },
        ...(canReportIcon
            ? [
                  {
                      description:
                          'Ask admins to review the organization icon.',
                      icon: Flag,
                      key: 'report-icon',
                      label: 'Report icon',
                  } satisfies SettingsNavigationItem<OrganizationSection>,
              ]
            : []),
    ];
}

function OrganizationSummary({
    organization,
}: {
    organization: OrganizationDetail;
}) {
    return (
        <header className="grid gap-5 border-b border-slate-200 pb-5 md:grid-cols-[6rem_minmax(0,1fr)] dark:border-white/10">
            <OrganizationIcon
                className="size-24"
                iconUrl={organization.iconUrl}
                name={organization.name}
            />
            <div className="min-w-0">
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent, #0891b2)' }}
                >
                    Organization
                </p>
                <h1 className="mt-2 text-3xl font-semibold">
                    {organization.name}
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {organization.memberCount} members -{' '}
                    {governanceLabel(organization.governanceType)}
                </p>
                {organization.governanceType === 'random' &&
                organization.leadershipRotatedAt ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Current leader assigned{' '}
                        {formatMessageTime(organization.leadershipRotatedAt)}
                    </p>
                ) : null}
                <h2 className="mt-5 text-xl font-semibold">
                    {organization.slogan || 'No slogan yet.'}
                </h2>
                <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                    {organization.description ||
                        'No description has been added yet.'}
                </p>
            </div>
        </header>
    );
}

function ReportIconPanel({
    error,
    onReasonChange,
    onSubmit,
    reason,
}: {
    error?: string;
    onReasonChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    reason: string;
}) {
    return (
        <form
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
            onSubmit={onSubmit}
        >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Flag className="size-4 text-red-500" />
                Report organization icon
            </h2>
            <textarea
                className="min-h-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                placeholder="Why should admins review this icon?"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
            />
            <InputError message={error} />
            <Button type="submit" variant="secondary">
                <Flag className="size-4" />
                Report icon
            </Button>
        </form>
    );
}

function governanceLabel(type: OrganizationDetail['governanceType']): string {
    if (type === 'anarchy') {
        return 'Anarchy';
    }

    if (type === 'random') {
        return 'Random monthly leader';
    }

    return 'Monarchy';
}

function LeaderPanel({
    errors,
    form,
    onDelete,
    onFormChange,
    onSubmit,
    onUpload,
    uploading,
}: {
    errors: Record<string, string>;
    form: OrganizationForm;
    onDelete: () => void;
    onFormChange: (form: OrganizationForm) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]">
            <header>
                <h2 className="text-lg font-semibold">Leader controls</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Edit details, upload an icon, or delete this organization.
                </p>
            </header>
            <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name" message={errors.name}>
                        <Input
                            value={form.name}
                            onChange={(event) =>
                                onFormChange({
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
                                onFormChange({
                                    ...form,
                                    slogan: event.target.value,
                                })
                            }
                        />
                    </Field>
                </div>
                <Field label="Description" message={errors.description}>
                    <textarea
                        className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                        value={form.description}
                        onChange={(event) =>
                            onFormChange({
                                ...form,
                                description: event.target.value,
                            })
                        }
                    />
                </Field>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit">
                        <Save className="size-4" />
                        Save
                    </Button>
                    <Button asChild disabled={uploading} variant="secondary">
                        <label>
                            <Upload className="size-4" />
                            Upload icon
                            <input
                                accept="image/*"
                                className="sr-only"
                                disabled={uploading}
                                type="file"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];

                                    if (file) {
                                        onUpload(file);
                                    }
                                }}
                            />
                        </label>
                    </Button>
                    <Button
                        onClick={onDelete}
                        type="button"
                        variant="destructive"
                    >
                        <Trash2 className="size-4" />
                        Delete organization
                    </Button>
                </div>
                <InputError message={errors.organization} />
                <InputError message={errors.icon} />
            </form>
        </section>
    );
}

function MembershipPanel({
    canLeave,
    errors,
    isMember,
    joinMessage,
    joinRequestStatus,
    onJoinMessageChange,
    onLeave,
    onOpenLeaderControls,
    onRequestJoin,
}: {
    canLeave: boolean;
    errors: Record<string, string>;
    isMember: boolean;
    joinMessage: string;
    joinRequestStatus: string | null;
    onJoinMessageChange: (value: string) => void;
    onLeave: () => void;
    onOpenLeaderControls: () => void;
    onRequestJoin: (event: FormEvent<HTMLFormElement>) => void;
}) {
    if (isMember) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]">
                <h2 className="text-lg font-semibold">Membership</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    You are a member of this organization.
                </p>
                {canLeave ? (
                    <Button
                        className="mt-4"
                        onClick={onLeave}
                        variant="secondary"
                    >
                        <LogOut className="size-4" />
                        Leave organization
                    </Button>
                ) : (
                    <>
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                            You are the last leader. Delete the organization
                            from leader controls instead of leaving it.
                        </p>
                        <Button
                            className="mt-4"
                            onClick={onOpenLeaderControls}
                            type="button"
                            variant="secondary"
                        >
                            <SlidersHorizontal className="size-4" />
                            Open leader controls
                        </Button>
                    </>
                )}
                <InputError message={errors.organization} />
            </section>
        );
    }

    return (
        <form
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]"
            onSubmit={onRequestJoin}
        >
            <h2 className="text-lg font-semibold">Request to enter</h2>
            {joinRequestStatus === 'pending' ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Your request is pending.
                </p>
            ) : (
                <>
                    <textarea
                        className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                        placeholder="Optional message to the leaders"
                        value={joinMessage}
                        onChange={(event) =>
                            onJoinMessageChange(event.target.value)
                        }
                    />
                    <Button type="submit">Request to enter</Button>
                </>
            )}
            <InputError message={errors.organization} />
        </form>
    );
}

function JoinRequestPanel({
    requests,
}: {
    requests: OrganizationJoinRequest[];
}) {
    function respond(request: OrganizationJoinRequest, approved: boolean) {
        router.patch(
            `/organization-join-requests/${request.id}`,
            { approved },
            { preserveScroll: true },
        );
    }

    return (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]">
            <h2 className="text-lg font-semibold">Join requests</h2>
            {requests.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No pending requests.
                </p>
            ) : null}
            {requests.map((request) => (
                <article
                    className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
                    key={request.id}
                >
                    <p className="font-medium">{request.requester.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {request.requester.email}
                    </p>
                    {request.message ? (
                        <p className="mt-2 text-sm leading-6">
                            {request.message}
                        </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                        <Button
                            onClick={() => respond(request, true)}
                            size="sm"
                            type="button"
                        >
                            <Check className="size-4" />
                            Approve
                        </Button>
                        <Button
                            onClick={() => respond(request, false)}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            <X className="size-4" />
                            Decline
                        </Button>
                    </div>
                </article>
            ))}
        </section>
    );
}

function ChatPanel({
    body,
    error,
    messages,
    showComposer,
    onBodyChange,
    onDeleteMessage,
    onHideMessage,
    onSubmit,
}: {
    body: string;
    error?: string;
    messages: OrganizationDetail['messages'];
    showComposer: boolean;
    onBodyChange: (value: string) => void;
    onDeleteMessage: (messageId: number) => void;
    onHideMessage: (messageId: number) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111820]">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquareText className="size-5" />
                Organization chat
            </h2>
            <div
                aria-label="Organization chat messages"
                className="grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 p-3 dark:border-white/10"
            >
                {messages.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        No messages yet.
                    </p>
                ) : null}
                {messages.map((message) => (
                    <article
                        className={[
                            'rounded-lg p-3 text-sm',
                            message.hiddenAt
                                ? 'border border-dashed border-amber-300 bg-amber-50 text-slate-700 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-slate-200'
                                : 'bg-slate-100 dark:bg-white/10',
                        ].join(' ')}
                        key={message.id}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <p className="font-medium">
                                    {message.user.name}
                                </p>
                                {message.hiddenAt ? (
                                    <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-300/20 dark:text-amber-100">
                                        Hidden
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                                <time
                                    className="text-xs text-slate-500 dark:text-slate-400"
                                    dateTime={message.createdAt ?? undefined}
                                >
                                    {formatMessageTime(message.createdAt)}
                                </time>
                                {message.canHide ? (
                                    <Button
                                        aria-label="Hide message from users"
                                        onClick={() =>
                                            onHideMessage(message.id)
                                        }
                                        size="icon"
                                        title="Hide message from users"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <EyeOff className="size-4" />
                                    </Button>
                                ) : null}
                                {message.canDelete ? (
                                    <Button
                                        aria-label="Delete message"
                                        onClick={() =>
                                            onDeleteMessage(message.id)
                                        }
                                        size="icon"
                                        title="Delete message"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                        <p className="mt-1 leading-6 whitespace-pre-wrap">
                            {message.body}
                        </p>
                        {message.hiddenAt ? (
                            <p className="mt-2 text-xs text-amber-800 dark:text-amber-100">
                                Hidden by {message.hiddenBy?.name ?? 'an admin'}
                            </p>
                        ) : null}
                    </article>
                ))}
            </div>
            {showComposer ? (
                <form className="flex gap-2" onSubmit={onSubmit}>
                    <Input
                        placeholder="Write a message"
                        value={body}
                        onChange={(event) => onBodyChange(event.target.value)}
                    />
                    <Button type="submit">
                        <Send className="size-4" />
                        Send
                    </Button>
                </form>
            ) : null}
            <InputError message={error} />
        </section>
    );
}

function MemberList({
    canPromote,
    errors,
    members,
    onPromote,
}: {
    canPromote: boolean;
    errors: Record<string, string>;
    members: OrganizationDetail['members'];
    onPromote: (membershipId: number) => void;
}) {
    return (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111820]">
            <h2 className="text-sm font-semibold">Members</h2>
            {members.map((member) => (
                <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"
                    key={member.id}
                >
                    <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {member.role}
                        </p>
                    </div>
                    {canPromote && member.role === 'member' ? (
                        <Button
                            onClick={() => onPromote(member.id)}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            <UserPlus className="size-4" />
                            Make leader
                        </Button>
                    ) : null}
                </div>
            ))}
            <InputError message={errors.organization} />
        </section>
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
