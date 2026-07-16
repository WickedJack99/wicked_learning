<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Settings\Queries\LoadPersonalSettings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PersonalSettingsController extends Controller
{
    private const SECTIONS = ['profile', 'appearance', 'language', 'notifications', 'security', 'delete-account'];

    public function __construct(private readonly LoadPersonalSettings $personalSettings) {}

    public function edit(Request $request): Response
    {
        $section = $request->string('section')->toString();

        return Inertia::render('settings/personal', [
            ...$this->personalSettings->handle(
                $request->user(),
                $request->session()->get('status'),
            ),
            'initialSection' => in_array($section, self::SECTIONS, true) ? $section : 'profile',
        ]);
    }
}
