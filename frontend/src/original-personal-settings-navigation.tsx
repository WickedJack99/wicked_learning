import {
    Bell,
    Brush,
    KeyRound,
    Languages,
    MessageSquareText,
    Trash2,
    UserRound,
    Volume2,
    type LucideIcon,
} from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

export type PersonalSettingsSection =
    | 'appearance'
    | 'delete-account'
    | 'feedback'
    | 'language'
    | 'notifications'
    | 'profile'
    | 'security'
    | 'sound';

type PersonalSettingsNavigationItem = {
    description: string;
    danger?: boolean;
    icon: LucideIcon;
    key: PersonalSettingsSection;
    label: string;
};

// Adapted from resources/js/pages/settings/personal.tsx and
// resources/js/components/settings-configuration-shell.tsx. The Rust route
// keeps URL-based selection in place of Inertia's in-page state, but retains
// the source navigation's order, copy, tab semantics and keyboard controls.
const items: PersonalSettingsNavigationItem[] = [
    {
        description: 'Identity and account details.',
        icon: UserRound,
        key: 'profile',
        label: 'Profile',
    },
    {
        description: 'Light and dark appearance.',
        icon: Brush,
        key: 'appearance',
        label: 'Appearance',
    },
    {
        description: 'Platform and learner copy.',
        icon: Languages,
        key: 'language',
        label: 'Language',
    },
    {
        description: 'Future reminders and quiet hours.',
        icon: Bell,
        key: 'notifications',
        label: 'Notifications',
    },
    {
        description: 'Share thoughts about the platform and manage invitations.',
        icon: MessageSquareText,
        key: 'feedback',
        label: 'Feedback',
    },
    {
        description: 'Sound effects and ambient audio.',
        icon: Volume2,
        key: 'sound',
        label: 'Sound',
    },
    {
        description: 'Password, two-factor and passkeys.',
        icon: KeyRound,
        key: 'security',
        label: 'Security',
    },
    {
        danger: true,
        description: 'Permanently remove your account.',
        icon: Trash2,
        key: 'delete-account',
        label: 'Delete account',
    },
];

function hrefFor(section: PersonalSettingsSection): string {
    return section === 'profile'
        ? '/settings'
        : `/settings?panel=personal&personal=${section}`;
}

export function OriginalPersonalSettingsNavigation({
    activeSection,
}: {
    activeSection: PersonalSettingsSection;
}) {
    const navigate = useNavigate();
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    function select(section: PersonalSettingsSection): void {
        navigate(hrefFor(section));
    }

    function moveToSection(
        index: number,
        direction: 'first' | 'last' | 'next' | 'previous',
    ): void {
        const targetIndex =
            direction === 'first'
                ? 0
                : direction === 'last'
                  ? items.length - 1
                  : direction === 'next'
                    ? (index + 1) % items.length
                    : (index - 1 + items.length) % items.length;
        const target = items[targetIndex];

        if (!target) {
            return;
        }

        select(target.key);
        buttonRefs.current[targetIndex]?.focus();
    }

    function onKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            moveToSection(index, 'next');
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            moveToSection(index, 'previous');
        } else if (event.key === 'Home') {
            event.preventDefault();
            moveToSection(index, 'first');
        } else if (event.key === 'End') {
            event.preventDefault();
            moveToSection(index, 'last');
        }
    }

    return (
        <aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-3 lg:border-r lg:border-b-0">
            <div
                aria-label="Personal settings sections"
                className="grid auto-rows-max content-start gap-2"
                role="tablist"
            >
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const active = activeSection === item.key;

                    return (
                        <button
                            aria-selected={active}
                            className={[
                                'relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                active
                                    ? item.danger
                                        ? 'bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-200'
                                        : 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                    : item.danger
                                      ? 'text-red-600 hover:bg-red-50 dark:text-red-200 dark:hover:bg-red-400/10'
                                      : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                            ].join(' ')}
                            key={item.key}
                            onClick={() => select(item.key)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                            ref={(element) => {
                                buttonRefs.current[index] = element;
                            }}
                            role="tab"
                            tabIndex={active ? 0 : -1}
                            type="button"
                        >
                            <span
                                aria-hidden="true"
                                className={[
                                    'absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity',
                                    item.danger
                                        ? 'bg-red-500'
                                        : 'bg-[var(--settings-accent)]',
                                    active ? 'opacity-100' : 'opacity-0',
                                ].join(' ')}
                            />
                            <Icon className="mt-0.5 size-4 shrink-0" />
                            <span className="min-w-0">
                                <span className="block">{item.label}</span>
                                <span
                                    className={[
                                        'mt-1 block text-xs leading-5',
                                        active
                                            ? 'opacity-80'
                                            : 'text-[var(--settings-muted-text)]',
                                    ].join(' ')}
                                >
                                    {item.description}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}
