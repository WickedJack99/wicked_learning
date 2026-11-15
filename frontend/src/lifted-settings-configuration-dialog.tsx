import type { ComponentProps } from 'react';
import { LiftedDialogContent as DialogContent } from './lifted-dialog';
import { classNames as cn } from './lifted-class-names';

/**
 * Gives configuration editors the same working width as full settings pages
 * while preserving the modal workflow used by graph editors.
 */
export function SettingsConfigurationDialog({
    children,
    className,
    ...props
}: ComponentProps<typeof DialogContent>) {
    return (
        <DialogContent
            className={cn(
                'settings-surface max-h-[calc(100svh-8rem)] overflow-hidden sm:max-w-[92rem]',
                className,
            )}
            {...props}
        >
            {children}
        </DialogContent>
    );
}
