<?php

namespace Database\Seeders;

use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // Do not use the User factory here. Faker is a development dependency
        // and production Docker images intentionally install Composer without it.
        $user = User::query()->updateOrCreate(['email' => 'test@example.com'], [
            'name' => 'Test User',
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'email' => 'test@example.com',
            'role' => User::ROLE_ADMIN,
            'roles' => [User::ROLE_ADMIN],
            'login_disabled_at' => null,
            'banned_until' => null,
        ]);
        $user->setAssignedRoles([User::ROLE_ADMIN]);
        $user->save();

        LearningWorld::query()->firstOrCreate(
            ['slug' => 'demo-learning-world'],
            [
                'title' => 'Learning World',
                'description' => 'Start by creating a map for this learning world.',
            ],
        );

        // Learning worlds, maps, nodes and activities start empty. Administrators
        // can create the first world and place MapAssets through the UI.
    }
}
