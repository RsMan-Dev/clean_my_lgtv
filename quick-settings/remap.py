"""Own only key 139. Preserve other bindings and provide a targeted rollback."""
import json
import os
import sys
from pathlib import Path

CONFIG = Path('/home/root/.config/lginputhook/keybinds.json')
BACKUP = Path('/var/lib/webosbrew/quick-settings/key139-before.json')
BINDING = {'action': 'launch', 'id': 'org.local.quicksettings'}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write in place: the native hook watches the config inode for modifications.
    with path.open('w') as output:
        json.dump(value, output)
        output.flush()
        os.fsync(output.fileno())


def main():
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    if sys.argv[1] == 'enable':
        if not BACKUP.exists():
            write_json(BACKUP, {'present': '139' in config, 'binding': config.get('139')})
        config['139'] = BINDING
    elif sys.argv[1] == 'disable':
        if config.get('139') != BINDING:
            print('Binding changed elsewhere; leaving it untouched.')
            return
        saved = json.loads(BACKUP.read_text())
        if saved['present']:
            config['139'] = saved['binding']
        else:
            config.pop('139', None)
    else:
        raise ValueError('Expected enable or disable')
    write_json(CONFIG, config)
    print(json.dumps(config))


if __name__ == '__main__':
    main()
