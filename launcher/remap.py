"""Own Home key 773 only; do not change Settings key 139 or other bindings."""
import json
import os
from pathlib import Path
import sys

BASE = Path('/var/lib/webosbrew/launcher')
CONFIG = Path('/home/root/.config/lginputhook/keybinds.json')
BINDING = {'action':'launch', 'id':'org.local.cleanlauncher'}


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w') as output:
        json.dump(value, output)
        output.flush()
        os.fsync(output.fileno())


def main():
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    backup = BASE / 'key773-before.json'
    marker = BASE / 'enabled'
    if sys.argv[1:] == ['enable']:
        if not backup.exists():
            write(backup, {'present':'773' in config, 'binding':config.get('773')})
        config['773'] = BINDING
        write(CONFIG, config)
        marker.touch()
    elif sys.argv[1:] == ['disable']:
        marker.unlink(missing_ok=True)
        if config.get('773') == BINDING:
            saved = json.loads(backup.read_text())
            if saved['present']:
                config['773'] = saved['binding']
            else:
                config.pop('773', None)
            write(CONFIG, config)
    else:
        raise ValueError('Use enable or disable')


if __name__ == '__main__':
    main()
