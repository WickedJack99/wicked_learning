import type { CSSProperties } from 'react';

export type ResolvedAppearance = 'dark' | 'light';

export type ThemeVariant<T> = T & {
    dark?: Partial<T>;
    light?: Partial<T>;
};

export type TileStyle = CSSProperties & {
    '--tile-highlight': string;
};

export const worldHref = '/world';
