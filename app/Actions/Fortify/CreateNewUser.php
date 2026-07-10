<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\RegistrationToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'appearance' => ['nullable', 'string', Rule::in(['light', 'dark'])],
            'password' => $this->passwordRules(),
            'registration_token' => ['required', 'string', 'max:120'],
        ])->validate();

        return DB::transaction(function () use ($input): User {
            $registrationToken = RegistrationToken::query()
                ->where('token_hash', RegistrationToken::hashToken($input['registration_token']))
                ->lockForUpdate()
                ->first();

            if (! $registrationToken || ! $registrationToken->canBeUsed()) {
                throw ValidationException::withMessages([
                    'registration_token' => 'This registration token is invalid, expired or has already been used.',
                ]);
            }

            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                'role' => $registrationToken->role,
                'roles' => $registrationToken->grantedRoles(),
            ]);
            $user->setAssignedRoles($registrationToken->grantedRoles());
            $user->save();

            $user->preference()->create([
                'appearance' => $input['appearance'] ?? 'light',
            ]);

            $registrationToken->forceFill([
                'used_by_user_id' => $user->id,
                'used_at' => now(),
            ])->save();

            return $user;
        });
    }
}
