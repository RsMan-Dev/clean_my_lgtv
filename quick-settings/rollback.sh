#!/bin/sh
# Restore only our Settings binding; retain any other user remaps.
set -eu
python3 /var/lib/webosbrew/quick-settings/remap.py disable
rm -f /var/lib/webosbrew/quick-settings/enabled
chmod -x /var/lib/webosbrew/init.d/92-quick-settings
echo 'LG Settings button restored. The panel remains available in the app list.'
