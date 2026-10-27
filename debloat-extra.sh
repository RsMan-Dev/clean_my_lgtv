#!/bin/sh
# Runtime bind mounts leave firmware binaries intact. Reapplied by Homebrew.
set -eu
state=/run/local-debloat-extra
hook=/var/lib/webosbrew/init.d/91-local-debloat-extra
targets='/usr/sbin/acr2 /usr/sbin/admanager /usr/sbin/adoverlay-service /usr/sbin/sportsalarm /usr/sbin/trigger_alexa /usr/sbin/amazon-alexa-adapter /usr/palm/services/com.webos.service.iotclient/iot-client'
family=/usr/palm/services/com.webos.service.familycare/index.js
case "${1:-apply}" in
    apply)
        mkdir -p "$state"
        touch "$state/mounts"
        if [ ! -f "$state/disabled" ]; then
            printf '#!/bin/sh\nexit 0\n' > "$state/disabled"
            chmod 755 "$state/disabled"
            printf 'process.exit(0);\n' > "$state/disabled.js"
        fi
        mkdir -p /run/systemd/system/iot-client.service.d
        printf '[Unit]\nConditionPathExists=!%s\n' "$state" > /run/systemd/system/iot-client.service.d/91-local-debloat.conf
        systemctl daemon-reload
        systemctl --no-block stop iot-client.service
        for target in $targets "$family"; do
            [ -f "$target" ] || continue
            if ! mountpoint -q "$target"; then
                stub="$state/disabled"
                [ "$target" != "$family" ] || stub="$state/disabled.js"
                mount --bind "$stub" "$target"
                printf '%s\n' "$target" >> "$state/mounts"
            elif ! grep -Fxq "$target" "$state/mounts"; then
                printf 'Existing external mount, leaving unchanged: %s\n' "$target" >&2
                continue
            fi
            for entry in /proc/[0-9]*/exe; do
                executable=$(readlink "$entry" 2>/dev/null) || continue
                pid=${entry#/proc/}
                pid=${pid%/exe}
                if [ "$executable" = "$target" ]; then
                    kill -TERM "$pid" 2>/dev/null || true
                elif [ "$target" = "$family" ] && [ "$executable" = /usr/bin/iotjs ]; then
                    command=$(tr '\000' ' ' < "/proc/$pid/cmdline" 2>/dev/null) || continue
                    case "$command" in
                        "/usr/bin/iotjs $family "*) kill -TERM "$pid" 2>/dev/null || true ;;
                    esac
                fi
            done
        done
        ;;
    undo)
        chmod -x "$hook"
        if [ -f "$state/mounts" ]; then
            while IFS= read -r target; do
                if mountpoint -q "$target"; then umount "$target"; fi
            done < "$state/mounts"
            rm -f "$state/mounts"
        fi
        rm -f /run/systemd/system/iot-client.service.d/91-local-debloat.conf
        systemctl daemon-reload
        # Dynamic Luna services are now available again on demand.
        ;;
    *) printf 'Usage: %s [apply|undo]\n' "$0" >&2; exit 2 ;;
esac
