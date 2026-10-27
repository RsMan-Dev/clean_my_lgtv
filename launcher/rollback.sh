#!/bin/sh
set -eu
if [ -f /var/lib/webosbrew/launcher/native-home/idle-original.json ]; then
    node /var/lib/webosbrew/launcher/native-home/idle.js disable
fi
if [ -f /var/lib/webosbrew/launcher/native-home/default-apps.json ]; then
    node /var/lib/webosbrew/launcher/native-home/home.js disable
fi
python3 /var/lib/webosbrew/launcher/remap.py disable
luna-send -n 1 -w 5000 luna://org.local.quicksettings.service/launcherWatch '{}' || true
luna-send -n 1 -w 3000 luna://com.webos.applicationManager/closeByAppId '{"id":"org.local.cleanlauncher"}' || true
luna-send -n 1 -w 3000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
