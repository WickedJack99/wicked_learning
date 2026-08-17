<?php

return [
    'provider_http' => [
        'attempts' => 3,
        'connect_timeout_seconds' => 10,
        'timeout_seconds' => 60,
        'retry_delays_ms' => [250, 750],
        'max_retry_after_ms' => 5000,
    ],
];
