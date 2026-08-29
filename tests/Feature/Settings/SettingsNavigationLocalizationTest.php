<?php

test('settings navigation translation keys exist in the English catalog', function () {
    $navigation = file_get_contents(
        resource_path('js/features/settings/settings-navigation.ts'),
    );
    $catalog = json_decode(
        file_get_contents(base_path('lang/en.json')),
        true,
        flags: JSON_THROW_ON_ERROR,
    );

    preg_match_all(
        "/(?:labelKey|descriptionKey):\\s*'([^']+)'/",
        $navigation,
        $matches,
    );

    $translationKeys = array_values(array_unique($matches[1]));
    $missingKeys = array_values(array_diff($translationKeys, array_keys($catalog)));

    expect($missingKeys)->toBeEmpty();
});
