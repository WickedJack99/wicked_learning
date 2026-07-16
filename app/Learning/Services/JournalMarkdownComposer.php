<?php

namespace App\Learning\Services;

use App\Models\LearnerReflection;

/** Builds the editable markdown copy that mirrors journal reflection entries. */
class JournalMarkdownComposer
{
    public function append(string $markdown, LearnerReflection $reflection): string
    {
        $entry = implode("\n\n", [
            '## '.$reflection->title,
            '**Question**  '.trim($reflection->question),
            '**Reflection**  '.trim($reflection->reflection),
        ]);

        return trim($markdown) === '' ? $entry."\n" : rtrim($markdown)."\n\n".$entry."\n";
    }
}
