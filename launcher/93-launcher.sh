#!/bin/sh
set -eu
base=/var/lib/webosbrew/launcher
[ -f "$base/enabled" ] || exit 0
[ -f /media/developer/apps/usr/palm/applications/org.local.cleanlauncher/index.html ] || exit 0
[ -f /media/developer/apps/usr/palm/services/org.local.quicksettings.service/launcher.js ] || exit 0
luna-send -n 1 -w 5000 luna://org.local.quicksettings.service/launcherWatch '{}' >> /tmp/local-launcher.log 2>&1
