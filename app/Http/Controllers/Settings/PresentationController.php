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

class PresentationController extends Controller
{
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
            'welcome.pages' => ['required', 'array', 'min:1', 'max:6'],
            'welcome.pages.*.eyebrow' => ['required', 'string', 'max:120'],
            'welcome.pages.*.title' => ['required', 'string', 'max:160'],
            'welcome.pages.*.body' => ['required', 'string', 'max:1200'],
            'welcome.pages.*.primaryLabel' => ['required', 'string', 'max:80'],
        ]);

        PlatformPresentationSetting::updateCurrent($data, $request->user());

        return redirect()->route('settings.index', ['panel' => 'admin-presentation']);
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
