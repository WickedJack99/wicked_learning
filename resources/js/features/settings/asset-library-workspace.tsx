import type { ReactNode } from 'react';

type AssetLibraryWorkspaceProps = {
    children: ReactNode;
    library?: ReactNode;
};

/**
 * The reusable asset editors all need the same relationship: an editing area
 * beside a searchable, independently scrollable library. Keep the separation
 * structural instead of rendering two card-like panes inside every editor.
 */
export function AssetLibraryWorkspace({
    children,
    library,
}: AssetLibraryWorkspaceProps) {
    if (library) {
        return (
            <div className="grid h-full min-h-0 overflow-hidden bg-[var(--settings-content-background)] lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-h-0 overflow-hidden">{children}</div>
                <div className="min-h-0 overflow-hidden border-t border-[var(--settings-border-color)] lg:border-t-0 lg:border-l">
                    {library}
                </div>
            </div>
        );
    }

    return (
        <div className="grid h-full min-h-0 overflow-hidden bg-[var(--settings-content-background)] lg:grid-cols-[minmax(0,1fr)_22rem] [&>aside]:border-t [&>aside]:border-[var(--settings-border-color)] lg:[&>aside]:border-t-0 lg:[&>aside]:border-l">
            {children}
        </div>
    );
}
