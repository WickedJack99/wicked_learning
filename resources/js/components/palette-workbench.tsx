import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { cn } from '@/lib/utils';

export type PaletteWorkbenchField = {
    field: string;
    label: string;
};

export type PalettePreviewTab = {
    content: ReactNode;
    id: string;
    label: string;
};

export type PaletteWorkbenchTheme = {
    accent: string;
    accentForeground: string;
    activeBackground: string;
    borderColor: string;
    contentBackground: string;
    mutedText: string;
    panelBackground: string;
    sidebarBackground: string;
};

type PaletteWorkbenchProps = {
    beforeFields?: ReactNode;
    disabled: boolean;
    fields: PaletteWorkbenchField[];
    intro: string;
    previewTabs: PalettePreviewTab[];
    previewTitle: string;
    renderField: (field: PaletteWorkbenchField) => ReactNode;
    theme?: PaletteWorkbenchTheme;
};

export function PaletteWorkbench({
    beforeFields,
    disabled,
    fields,
    intro,
    previewTabs,
    previewTitle,
    renderField,
    theme = defaultWorkbenchTheme,
}: PaletteWorkbenchProps) {
    const [activePreviewId, setActivePreviewId] = useState(
        previewTabs[0]?.id ?? '',
    );
    const activePreview =
        previewTabs.find((tab) => tab.id === activePreviewId) ?? previewTabs[0];

    return (
        <section
            className="grid h-full min-h-0 overflow-hidden border border-[var(--palette-workbench-border)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"
            style={
                {
                    '--palette-workbench-accent': theme.accent,
                    '--palette-workbench-accent-foreground':
                        theme.accentForeground,
                    '--palette-workbench-active': theme.activeBackground,
                    '--palette-workbench-border': theme.borderColor,
                    '--palette-workbench-content': theme.contentBackground,
                    '--palette-workbench-muted': theme.mutedText,
                    '--palette-workbench-panel': theme.panelBackground,
                    '--palette-workbench-sidebar': theme.sidebarBackground,
                } as CSSProperties
            }
        >
            <div className="flex min-h-0 flex-col border-b border-[var(--palette-workbench-border)] xl:border-r xl:border-b-0">
                <div className="shrink-0 border-b border-[var(--palette-workbench-border)] px-5 py-4 text-sm leading-6 text-[var(--palette-workbench-muted)]">
                    {intro}
                    {disabled ? (
                        <span className="mt-1 block text-amber-600 dark:text-amber-200">
                            You can inspect these colors, but your role cannot
                            save this section.
                        </span>
                    ) : null}
                </div>
                <div
                    className={cn(
                        'min-h-0 flex-1',
                        disabled && 'pointer-events-none opacity-70',
                    )}
                >
                    {beforeFields}
                    <LearnerPaginatedItems
                        className="divide-y divide-[var(--palette-workbench-border)]"
                        items={fields}
                        pageSize={3}
                        paginationButtonClassName="inline-flex items-center gap-1 text-sm text-[var(--palette-workbench-accent)] transition hover:text-white disabled:pointer-events-none disabled:opacity-40"
                        paginationClassName="flex items-center justify-between border-t border-[var(--palette-workbench-border)] px-5 py-3"
                        paginationTextClassName="text-xs text-[var(--palette-workbench-muted)]"
                        renderItem={(field) => (
                            <div className="px-5 py-4" key={field.field}>
                                {renderField(field)}
                            </div>
                        )}
                    />
                </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--palette-workbench-content)] text-white">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--palette-workbench-border)] px-5 py-4">
                    <div>
                        <p className="text-xs font-medium tracking-[0.16em] text-[var(--palette-workbench-accent)] uppercase">
                            Live preview
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                            {previewTitle}
                        </h3>
                    </div>
                    {previewTabs.length > 1 ? (
                        <div className="flex items-center gap-1">
                            {previewTabs.map((tab) => (
                                <button
                                    className={cn(
                                        'border-b-2 border-transparent px-3 py-1.5 text-xs font-medium transition',
                                        activePreview?.id === tab.id
                                            ? 'border-[var(--palette-workbench-accent)] text-[var(--palette-workbench-accent)]'
                                            : 'text-[var(--palette-workbench-muted)] hover:text-white',
                                    )}
                                    key={tab.id}
                                    onClick={() => setActivePreviewId(tab.id)}
                                    type="button"
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
                <div className="min-h-[24rem] flex-1 overflow-y-auto p-5">
                    {activePreview?.content}
                </div>
            </div>
        </section>
    );
}

const defaultWorkbenchTheme: PaletteWorkbenchTheme = {
    accent: '#2dd4bf',
    accentForeground: '#042f2e',
    activeBackground: 'rgba(45, 212, 191, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    contentBackground: '#0b1117',
    mutedText: '#94a3b8',
    panelBackground: '#111820',
    sidebarBackground: '#111820',
};
