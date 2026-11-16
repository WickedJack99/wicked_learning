/** Direct lift of main WorldBuilderSettingsPanel's unavailable state. */
export function UnavailableWorldBuilder() {
    return (
        <section className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-lg text-sm leading-6 text-[var(--settings-muted-text)]">
                World builder settings are not available with the current
                permissions.
            </p>
        </section>
    );
}
