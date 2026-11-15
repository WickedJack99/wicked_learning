import type { HTMLAttributes } from 'react';

import { classNames } from './lifted-class-names';

/** Direct lift of main:resources/js/components/input-error.tsx. */
export function LiftedInputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p
            {...props}
            className={classNames(
                'text-sm text-red-600 dark:text-red-400',
                className,
            )}
        >
            {message}
        </p>
    ) : null;
}
