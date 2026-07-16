<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\CreatePlatformLanguageRequest;
use App\Http\Requests\Settings\ImportTranslationCatalogRequest;
use App\Http\Requests\Settings\UpdatePlatformLanguageRequest;
use App\Localization\Actions\CreatePlatformLanguage;
use App\Localization\Actions\ImportTranslationCatalog;
use App\Localization\Actions\UpdatePlatformLanguage;
use App\Localization\Queries\LoadLanguageAdministration;
use App\Localization\Services\TranslationCatalogExportService;
use App\Models\PlatformLanguage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminLanguageController extends Controller
{
    public function __construct(
        private readonly LoadLanguageAdministration $languages,
        private readonly CreatePlatformLanguage $createLanguage,
        private readonly UpdatePlatformLanguage $updateLanguage,
        private readonly TranslationCatalogExportService $exports,
        private readonly ImportTranslationCatalog $imports,
    ) {}

    public function index(): Response
    {
        return Inertia::render('settings/languages', ['languages' => $this->languages->handle()]);
    }

    public function store(CreatePlatformLanguageRequest $request): RedirectResponse
    {
        $this->createLanguage->handle($request->validated(), $request->user());

        return to_route('settings.languages.index');
    }

    public function update(UpdatePlatformLanguageRequest $request, PlatformLanguage $language): RedirectResponse
    {
        $this->updateLanguage->handle($language, $request->validated(), $request->user());

        return to_route('settings.languages.index');
    }

    public function export(Request $request, ?PlatformLanguage $language = null)
    {
        $catalog = $language ? $this->exports->forLanguage($language) : $this->exports->english();
        $code = $language?->code ?? 'en';

        return response()->streamDownload(
            fn () => print json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            "learning-worlds-{$code}-translations.json",
            ['Content-Type' => 'application/json'],
        );
    }

    public function import(ImportTranslationCatalogRequest $request, PlatformLanguage $language): RedirectResponse
    {
        $uploadedFile = $request->file('catalog');
        $json = $uploadedFile
            ? json_decode((string) file_get_contents($uploadedFile->getRealPath()), true)
            : null;

        if (! is_array($json)) {
            return back()->withErrors(['catalog' => 'The uploaded file is not valid JSON.']);
        }

        $this->imports->handle($language, $json, $request->user());

        return to_route('settings.languages.index');
    }
}
