#!/bin/sh
# Start the existing remapper only while our app, helper and binding are present.
set -eu
base=/var/lib/webosbrew/quick-settings
[ -f "$base/enabled" ] || exit 0
[ -f /media/developer/apps/usr/palm/services/org.local.quicksettings.service/engine.js ] || exit 0
[ -f /media/developer/apps/usr/palm/applications/org.local.quicksettings/index.html ] || exit 0
elevate=/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service
for service in org.local.quicksettings.service org.webosbrew.inputhook.service; do
  definition="/var/luna-service2-dev/services.d/$service.service"
  if [ -f "$definition" ] && ! grep -q 'hbchannel.service/run-js-service' "$definition"; then
    "$elevate" "$service" >> /tmp/quick-settings-boot.log 2>&1
  fi
done
luna-send -n 1 -w 10000 -a org.local.quicksettings \
  luna://org.local.quicksettings.service/ping '{}' >> /tmp/quick-settings-boot.log 2>&1
exec luna-send -n 1 -w 10000 -a org.webosbrew.inputhook \
  luna://org.webosbrew.inputhook.service/start '{}'
