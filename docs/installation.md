# Installation and recovery

Commands below assume an SSH host named `lg-tv` with root access, working Homebrew startup hooks and LG Input Hook 1.5.0 already installed. Adjust host and IPK versions as necessary. Keep backups of existing key bindings, Home settings and Homebrew hooks before changes. Inspect any pre-existing test profile layer: the Home routing scripts intentionally refuse an unknown or third-party layer.

## Install the apps

Build as described in the [README](../README.md). Copy both generated IPKs to `/tmp` on the TV. Install quick settings first, then the launcher, waiting for `state: installed` for each:

```sh
scp quick-settings/org.local.quicksettings_0.3.5_all.ipk launcher/org.local.cleanlauncher_0.2.4_all.ipk lg-tv:/tmp/
ssh -tt lg-tv "luna-send -n 25 -w 10000 luna://com.webos.appInstallService/dev/install '{\"id\":\"org.local.quicksettings\",\"ipkUrl\":\"/tmp/org.local.quicksettings_0.3.5_all.ipk\",\"subscribe\":true}'"
ssh -tt lg-tv "luna-send -n 25 -w 10000 luna://com.webos.appInstallService/dev/install '{\"id\":\"org.local.cleanlauncher\",\"ipkUrl\":\"/tmp/org.local.cleanlauncher_0.2.4_all.ipk\",\"subscribe\":true}'"
```

The quick settings service is shared by both apps. Do not remove it while either app needs it. Install the scripts and activate the bindings:

```sh
ssh lg-tv 'mkdir -p /var/lib/webosbrew/quick-settings /var/lib/webosbrew/launcher/native-home /var/lib/webosbrew/init.d'
scp quick-settings/remap.py quick-settings/rollback.sh quick-settings/control.js lg-tv:/var/lib/webosbrew/quick-settings/
scp launcher/remap.py launcher/rollback.sh lg-tv:/var/lib/webosbrew/launcher/
scp launcher/native-home/home.js launcher/native-home/idle.js lg-tv:/var/lib/webosbrew/launcher/native-home/
scp quick-settings/92-quick-settings.sh lg-tv:/var/lib/webosbrew/init.d/92-quick-settings
scp launcher/93-launcher.sh lg-tv:/var/lib/webosbrew/init.d/93-launcher
scp launcher/native-home/94-home-guard.sh lg-tv:/var/lib/webosbrew/init.d/94-home-guard
ssh lg-tv 'chmod 755 /var/lib/webosbrew/init.d/92-quick-settings /var/lib/webosbrew/init.d/93-launcher /var/lib/webosbrew/init.d/94-home-guard /var/lib/webosbrew/quick-settings/rollback.sh /var/lib/webosbrew/launcher/rollback.sh'
ssh lg-tv 'python3 /var/lib/webosbrew/quick-settings/remap.py enable && python3 /var/lib/webosbrew/launcher/remap.py enable'
ssh lg-tv 'touch /var/lib/webosbrew/quick-settings/enabled'
ssh -tt lg-tv /var/lib/webosbrew/init.d/92-quick-settings
ssh -tt lg-tv /var/lib/webosbrew/init.d/93-launcher
ssh -tt lg-tv 'node /var/lib/webosbrew/launcher/native-home/home.js enable && node /var/lib/webosbrew/launcher/native-home/idle.js enable'
```

The remappers save each original binding once; preserve the snapshots until rollback. Settings key 139 opens the panel and Home key 773 opens the launcher. Home routing sets the default Home destination and a narrow idle profile override. The guard retries at startup and restores destinations if the custom app disappears. The explicit LG Home entry remains available. The compatibility hook does not subscribe to foreground changes.

After reinstalling quick settings, run `92-quick-settings` again to elevate its service. Verify the panel, Home, Back, audio, network and the original LG screens on the actual device.

## Optional cleanup

```sh
scp debloat-services.sh lg-tv:/var/lib/webosbrew/init.d/90-local-debloat
scp debloat-extra.sh lg-tv:/var/lib/webosbrew/init.d/91-local-debloat-extra
ssh lg-tv 'chmod 755 /var/lib/webosbrew/init.d/90-local-debloat /var/lib/webosbrew/init.d/91-local-debloat-extra'
ssh lg-tv 'sh /var/lib/webosbrew/init.d/90-local-debloat apply && sh /var/lib/webosbrew/init.d/91-local-debloat-extra apply'
```

The first hook excludes seven services through temporary systemd configuration. The second uses runtime bind mounts for seven executables and Family Care's JavaScript. The firmware files remain intact. The effects depend on firmware and may affect features; review both scripts before use.

## Rollback

```sh
ssh -tt lg-tv /var/lib/webosbrew/launcher/rollback.sh
ssh lg-tv /var/lib/webosbrew/quick-settings/rollback.sh
ssh lg-tv 'sh /var/lib/webosbrew/init.d/91-local-debloat-extra undo'
ssh lg-tv 'sh /var/lib/webosbrew/init.d/90-local-debloat undo'
```

The launcher rollback restores idle routing before Home routing and restores its key only if it still owns the binding. A third-party-modified profile causes a refusal rather than overwriting it. Settings rollback restores only its own key. Apps remain installed and can be removed afterwards. Cleanup `undo` disables its hook; re-enabling later requires making it executable again.

After a firmware update, check root, Homebrew, bindings and service compatibility before reapplying anything. Never replace new firmware files with old backups. A remote-control shutdown can be standby, not a full power-cycle test.
