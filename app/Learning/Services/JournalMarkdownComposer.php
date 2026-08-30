<?php

namespace App\Learning\Services;

use App\Models\LearnerReflection;

/** Builds the editable markdown copy that mirrors journal reflection entries. */
class JournalMarkdownComposer
{
    public function append(string $markdown, LearnerReflection $reflection): string
    {
        $parts = [
            '## '.$reflection->title,
            '**Question**  '.trim($reflection->question),
            '**Reflection**  '.trim($reflection->reflection),
        ];

        if ($reflection->response_type === 'transfer' && trim((string) $reflection->response_context) !== '') {
            $parts[] = '**Changed context**  '.trim((string) $reflection->response_context);
        }

        $entry = implode("\n\n", $parts);

        return trim($markdown) === '' ? $entry."\n" : rtrim($markdown)."\n\n".$entry."\n";
    }
}
