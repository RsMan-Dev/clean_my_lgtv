#!/bin/sh
# Homebrew boot hook: reversible service exclusions; no firmware files changed.
set -eu
marker=/var/lib/webosbrew/local-debloat-enabled
units='remotelogger service-logger rdxd uploadd contentminer nudge preload-manager'
case "${1:-apply}" in
    apply)
        touch "$marker"
        for unit in $units; do
            directory="/run/systemd/system/$unit.service.d"
            mkdir -p "$directory"
            printf '[Unit]\nConditionPathExists=!%s\n' "$marker" > "$directory/90-local-debloat.conf"
        done
        systemctl daemon-reload
        for unit in $units; do
            systemctl --no-block stop "$unit.service"
        done
        ;;
    undo)
        # Disable the boot hook before restoring services.
        chmod -x /var/lib/webosbrew/init.d/90-local-debloat
        rm -f "$marker"
        for unit in $units; do
            rm -f "/run/systemd/system/$unit.service.d/90-local-debloat.conf"
        done
        systemctl daemon-reload
        for unit in $units; do
            systemctl reset-failed "$unit.service" || true
            systemctl --no-block start "$unit.service"
        done
        ;;
    *)
        printf 'Usage: %s [apply|undo]\n' "$0" >&2
        exit 2
        ;;
esac
