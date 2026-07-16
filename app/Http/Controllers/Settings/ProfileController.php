<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileImageUploadRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Settings\Services\ProfileImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ProfileController extends Controller
{
    public function __construct(private readonly ProfileImageUploadService $profileImageUpload) {}

    /**
     * Show the user's profile settings page.
     */
    public function edit(): RedirectResponse
    {
        return to_route('settings.personal.edit', ['section' => 'profile']);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('settings.personal.edit', ['section' => 'profile']);
    }

    public function uploadImage(ProfileImageUploadRequest $request): JsonResponse
    {
        return response()->json(
            $this->profileImageUpload->upload($request->file('file')),
        );
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
