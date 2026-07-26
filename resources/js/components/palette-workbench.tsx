import { useState, type CSSProperties, type ReactNode } from 'react';
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
    disabled: boolean;
    fields: PaletteWorkbenchField[];
    intro: string;
    previewTabs: PalettePreviewTab[];
    previewTitle: string;
    renderField: (field: PaletteWorkbenchField) => ReactNode;
    theme?: PaletteWorkbenchTheme;
};

export function PaletteWorkbench({
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
            className="grid min-h-0 gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"
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
            <div className="grid min-h-0 gap-4">
                <div className="rounded-xl border border-[var(--palette-workbench-border)] bg-[var(--palette-workbench-active)] p-4 text-sm leading-6 text-[var(--palette-workbench-muted)]">
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
                        'grid max-h-[calc(100vh-22rem)] min-h-0 gap-3 overflow-y-auto pr-1',
                        disabled && 'pointer-events-none opacity-70',
                    )}
                >
                    {fields.map((field) => (
                        <div
                            className="rounded-xl border border-[var(--palette-workbench-border)] bg-[var(--palette-workbench-panel)] p-3"
                            key={field.field}
                        >
                            {renderField(field)}
                        </div>
                    ))}
                </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-xl border border-[var(--palette-workbench-border)] bg-[var(--palette-workbench-panel)] text-white shadow-sm">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--palette-workbench-border)] px-4 py-3">
                    <div>
                        <p className="text-xs font-medium tracking-[0.16em] text-[var(--palette-workbench-accent)] uppercase">
                            Live preview
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                            {previewTitle}
                        </h3>
                    </div>
                    {previewTabs.length > 1 ? (
                        <div className="flex rounded-lg border border-[var(--palette-workbench-border)] bg-[var(--palette-workbench-active)] p-1">
                            {previewTabs.map((tab) => (
                                <button
                                    className={cn(
                                        'rounded-md px-3 py-1.5 text-xs font-medium transition',
                                        activePreview?.id === tab.id
                                            ? 'bg-[var(--palette-workbench-accent)] text-[var(--palette-workbench-accent-foreground)]'
                                            : 'text-[var(--palette-workbench-muted)] hover:bg-[var(--palette-workbench-active)] hover:text-white',
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
                <div className="min-h-[34rem] overflow-y-auto bg-[var(--palette-workbench-content)] p-4">
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
