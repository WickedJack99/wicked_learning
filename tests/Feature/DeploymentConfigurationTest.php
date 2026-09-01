<?php

test('the application container serves HTTP behind the TLS terminating proxy', function () {
    $caddyfile = file_get_contents(base_path('docker/Caddyfile'));

    expect($caddyfile)
        ->toContain(":80 {")
        ->not->toContain('{$SERVER_NAME}');
});
