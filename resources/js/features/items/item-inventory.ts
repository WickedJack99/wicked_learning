import { useSyncExternalStore } from 'react';
import type { LearningItem } from '@/types';

let inventory: LearningItem[] = [];
const listeners = new Set<() => void>();

function emit() {
    for (const listener of listeners) {
        listener();
    }
}

export function setLearningItems(items: LearningItem[]) {
    inventory = items.filter((item) => item.quantity > 0);
    emit();
}

export function useAvailableLearningItems(seedItems: LearningItem[]) {
    if (inventory.length === 0 && seedItems.length > 0) {
        inventory = seedItems.filter((item) => item.quantity > 0);
    }

    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => inventory,
        () => seedItems,
    );
}
