<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\PlatformPresentationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PresentationController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/presentation', [
            'publicPresentation' => PlatformPresentationSetting::current(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'auth.backgroundImages.login.dark' => ['nullable', 'string', 'max:2048'],
            'auth.backgroundImages.login.light' => ['nullable', 'string', 'max:2048'],
            'auth.backgroundImages.register.dark' => ['nullable', 'string', 'max:2048'],
            'auth.backgroundImages.register.light' => ['nullable', 'string', 'max:2048'],
            'auth.backgroundImages.welcome.dark' => ['nullable', 'string', 'max:2048'],
            'auth.backgroundImages.welcome.light' => ['nullable', 'string', 'max:2048'],
            'cursors.default.image' => ['nullable', 'string', 'max:2048'],
            'cursors.default.hotspotX' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.default.hotspotY' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.default.size' => ['nullable', 'integer', 'min:16', 'max:128'],
            'cursors.default.fallback' => ['nullable', 'string', 'max:32'],
            'cursors.action.image' => ['nullable', 'string', 'max:2048'],
            'cursors.action.hotspotX' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.action.hotspotY' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.action.size' => ['nullable', 'integer', 'min:16', 'max:128'],
            'cursors.action.fallback' => ['nullable', 'string', 'max:32'],
            'cursors.grab.image' => ['nullable', 'string', 'max:2048'],
            'cursors.grab.hotspotX' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.grab.hotspotY' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.grab.size' => ['nullable', 'integer', 'min:16', 'max:128'],
            'cursors.grab.fallback' => ['nullable', 'string', 'max:32'],
            'cursors.text.image' => ['nullable', 'string', 'max:2048'],
            'cursors.text.hotspotX' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.text.hotspotY' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.text.size' => ['nullable', 'integer', 'min:16', 'max:128'],
            'cursors.text.fallback' => ['nullable', 'string', 'max:32'],
            'cursors.denied.image' => ['nullable', 'string', 'max:2048'],
            'cursors.denied.hotspotX' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.denied.hotspotY' => ['nullable', 'integer', 'min:0', 'max:64'],
            'cursors.denied.size' => ['nullable', 'integer', 'min:16', 'max:128'],
            'cursors.denied.fallback' => ['nullable', 'string', 'max:32'],
            'welcome.pages' => ['required', 'array', 'min:1', 'max:12'],
            'welcome.pages.*.backgrounds.dark' => ['nullable', 'string', 'max:2048'],
            'welcome.pages.*.backgrounds.light' => ['nullable', 'string', 'max:2048'],
            'welcome.pages.*.eyebrow' => ['required', 'string', 'max:120'],
            'welcome.pages.*.title' => ['required', 'string', 'max:160'],
            'welcome.pages.*.body' => ['required', 'string', 'max:1200'],
            'welcome.pages.*.primaryLabel' => ['nullable', 'string', 'max:80'],
            'welcome.pages.*.buttons' => ['nullable', 'array', 'max:6'],
            'welcome.pages.*.buttons.*.text' => ['required', 'string', 'max:80'],
            'welcome.pages.*.buttons.*.target' => ['required', 'string', 'max:2048'],
            'infoPages.pages' => ['nullable', 'array', 'max:24'],
            'infoPages.pages.*.key' => ['required', 'string', 'regex:/^[a-z0-9-]+$/', 'max:80'],
            'infoPages.pages.*.title' => ['required', 'string', 'max:120'],
            'infoPages.pages.*.markdown' => ['required', 'string', 'max:50000'],
            'infoPages.pages.*.backgrounds.dark' => ['nullable', 'string', 'max:2048'],
            'infoPages.pages.*.backgrounds.light' => ['nullable', 'string', 'max:2048'],
            'publicPalette.dark.headingText' => ['nullable', 'string', 'max:64'],
            'publicPalette.dark.bodyText' => ['nullable', 'string', 'max:64'],
            'publicPalette.dark.mutedText' => ['nullable', 'string', 'max:64'],
            'publicPalette.dark.accentText' => ['nullable', 'string', 'max:64'],
            'publicPalette.dark.controlText' => ['nullable', 'string', 'max:64'],
            'publicPalette.dark.controlBorder' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.headingText' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.bodyText' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.mutedText' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.accentText' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.controlText' => ['nullable', 'string', 'max:64'],
            'publicPalette.light.controlBorder' => ['nullable', 'string', 'max:64'],
            'sourceLinks.origin.label' => ['required', 'string', 'max:80'],
            'sourceLinks.origin.url' => ['required', 'url', 'max:2048'],
            'sourceLinks.custom' => ['nullable', 'array', 'max:12'],
            'sourceLinks.custom.*.label' => ['required', 'string', 'max:80'],
            'sourceLinks.custom.*.url' => ['required', 'url', 'max:2048'],
        ]);

        PlatformPresentationSetting::updateCurrent($data, $request->user());

        return redirect()->route('settings.presentation.edit');
    }

    public function uploadBackgroundImage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'file', 'max:5120'],
        ]);

        $image = $data['image'];

        if (! $image instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'image' => 'Please choose an image file.',
            ]);
        }

        $extension = strtolower($image->getClientOriginalExtension());
        $allowedExtensions = ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];

        if (! in_array($extension, $allowedExtensions, true)) {
            throw ValidationException::withMessages([
                'image' => 'The image must be a GIF, JPG, PNG, SVG or WEBP file.',
            ]);
        }

        $filename = Str::uuid()->toString().'.'.$extension;
        $path = $image->storeAs('presentation/backgrounds', $filename, 'public');

        abort_if($path === false, 500, 'The image could not be stored.');

        return response()->json([
            'url' => Storage::url($path),
        ]);
    }
}
