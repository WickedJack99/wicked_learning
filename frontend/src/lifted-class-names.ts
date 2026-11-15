import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Direct lift of main:resources/js/lib/utils.ts `cn`. */
export function classNames(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
