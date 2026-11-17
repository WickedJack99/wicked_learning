export type ModelControlMode = 'flexible' | 'reasoning' | 'sampling';

export type ModelControlRule = {
    mode: Exclude<ModelControlMode, 'flexible'>;
    modelPrefix: string;
    provider: string;
};

export function resolveModelControlMode(
    rules: ModelControlRule[],
    provider: string | undefined,
    model: string,
): ModelControlMode {
    const normalizedProvider = provider?.trim().toLowerCase() ?? '';
    const normalizedModel = model.trim().toLowerCase();
    const rule = rules.find(
        (candidate) =>
            candidate.provider === normalizedProvider &&
            normalizedModel.startsWith(candidate.modelPrefix),
    );

    return rule?.mode ?? 'flexible';
}
