import { Music2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ReusableSoundPicker } from '@/components/reusable-sound-picker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { LearningSound } from '@/types';
import type { ActivityForm, EditableSound } from './edit-node-activity-types';

/** Selects reusable ambience once and keeps runtime sound metadata server-owned. */
export function ActivityAmbientSoundFields({
    form,
    onChange,
    sounds,
}: {
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    sounds: EditableSound[];
}) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const selectedSound = useMemo(
        () =>
            sounds.find(
                (sound) => sound.id.toString() === form.activity_sound_id,
            ) ?? null,
        [form.activity_sound_id, sounds],
    );

    const selectSound = (sound: LearningSound) => {
        onChange((current) => ({
            ...current,
            activity_sound_enabled: true,
            activity_sound_id: sound.id.toString(),
        }));
        setIsPickerOpen(false);
    };

    return (
        <div className="grid gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <Music2 className="mt-0.5 size-5 shrink-0 text-[var(--settings-accent)]" />
                <div className="min-w-0">
                    <Label htmlFor="activity-sound-enabled">
                        Scene ambience
                    </Label>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Play one reusable sound while this activity is open. It
                        stops automatically when the learner continues.
                    </p>
                </div>
            </div>

            <label className="flex w-fit items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                    checked={form.activity_sound_enabled}
                    className="size-4 rounded border-slate-300 text-[var(--settings-accent)] focus:ring-[var(--settings-accent)]"
                    id="activity-sound-enabled"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            activity_sound_enabled: event.currentTarget.checked,
                        }))
                    }
                    type="checkbox"
                />
                Enable scene ambience
            </label>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/40">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {selectedSound
                        ? selectedSound.name
                        : 'No reusable sound selected'}
                </span>
                <Button
                    onClick={() => setIsPickerOpen(true)}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    <Search className="size-4" /> Select sound
                </Button>
                <Button
                    aria-label="Clear selected scene ambience"
                    disabled={!selectedSound}
                    onClick={() =>
                        onChange((current) => ({
                            ...current,
                            activity_sound_enabled: false,
                            activity_sound_id: '',
                        }))
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <X className="size-4" />
                </Button>
            </div>

            {isPickerOpen ? (
                <ReusableSoundPicker
                    currentValue={selectedSound?.url ?? ''}
                    onClear={() =>
                        onChange((current) => ({
                            ...current,
                            activity_sound_enabled: false,
                            activity_sound_id: '',
                        }))
                    }
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={selectSound}
                />
            ) : null}
        </div>
    );
}
