import { Bell } from 'lucide-react';

import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';

/** Source-adapted from PersonalSettingsContent's NotificationsPanel. */
export function OriginalPersonalNotificationsPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const t = usePlatformTranslation();

    return (
        <OriginalPersonalSettingsShell
            activeSection="notifications"
            appearance={appearance}
        >
            <section className="grid gap-5">
                <header className="flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                            <Bell className="size-5" />
                            <p className="text-xs font-medium tracking-[0.18em] uppercase">
                                {t(
                                    'settings.personal.sections.notifications',
                                    'Notifications',
                                )}
                            </p>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-normal text-[var(--settings-primary-text)]">
                            {t(
                                'settings.personal.notifications.title',
                                'Communication preferences',
                            )}
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.personal.notifications.description',
                                'This area will hold optional reminders, quiet hours and communication preferences. It will remain opt-in and avoid pressure-based learning loops.',
                            )}
                        </p>
                    </div>
                </header>
            </section>
        </OriginalPersonalSettingsShell>
    );
}
