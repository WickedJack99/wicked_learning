import { createContext, useContext } from 'react';

/**
 * A route family may provide this only after its documented Rust adapter has
 * established an exact source page-prop projection. The reset supplies no
 * fallback values, so a missing contract cannot look like successful data.
 */
export interface SourcePageProjection<TProps extends object> {
    component: string;
    props: TProps;
}

const sourcePageProjectionContext = createContext<SourcePageProjection<object> | null>(
    null,
);

export const SourcePageProjectionProvider = sourcePageProjectionContext.Provider;

export function useSourcePageProjection<TProps extends object>(): SourcePageProjection<TProps> | null {
    return useContext(sourcePageProjectionContext) as SourcePageProjection<TProps> | null;
}
