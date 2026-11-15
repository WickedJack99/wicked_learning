import * as LabelPrimitive from '@radix-ui/react-label';
import type * as React from 'react';

import { classNames } from './lifted-class-names';

/** Direct lift of main:resources/js/components/ui/label.tsx. */
export function LiftedLabel({
    className,
    ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
    return (
        <LabelPrimitive.Root
            data-slot="label"
            className={classNames(
                'text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}
