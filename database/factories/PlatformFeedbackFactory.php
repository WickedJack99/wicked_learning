<?php

namespace Database\Factories;

use App\Models\PlatformFeedback;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlatformFeedback>
 */
class PlatformFeedbackFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category' => 'general',
            'message' => fake()->sentence(),
            'submitted_at' => now(),
            'user_id' => User::factory(),
        ];
    }
}
