import { Loader2Icon } from 'lucide-react';
import type * as React from 'react';

import { classNames } from './lifted-class-names';

export function LiftedSpinner({ className, ...props }: React.ComponentProps<'svg'>) {
    return (
        <Loader2Icon
            aria-label="Loading"
            className={classNames('size-4 animate-spin', className)}
            role="status"
            {...props}
        />
    );
}
