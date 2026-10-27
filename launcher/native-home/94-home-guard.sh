#!/bin/sh
# Install as a webOS Homebrew init hook only after home.js is deployed.
base=/var/lib/webosbrew/launcher/native-home
[ -f "$base/default-apps.json" ] || exit 0
[ -f "$base/home.js" ] || exit 0
lock=/run/clean-home-guard.lock
mkdir "$lock" 2>/dev/null || exit 0
(
    trap 'rmdir "$lock"' EXIT HUP INT TERM
    attempt=0
    while [ "$attempt" -lt 15 ]; do
        if /usr/bin/node "$base/home.js" guard </dev/null >> /tmp/clean-home-guard.log 2>&1 &&
           { [ ! -f "$base/idle.js" ] || /usr/bin/node "$base/idle.js" guard </dev/null >> /tmp/clean-home-guard.log 2>&1; }; then
            exit 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo 'Home guard exhausted retries' >> /tmp/clean-home-guard.log
    exit 1
) </dev/null >/dev/null 2>&1 &
exit 0
