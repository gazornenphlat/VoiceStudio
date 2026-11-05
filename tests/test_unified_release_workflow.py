"""A desktop release cannot silently omit the phone binaries."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]


def workflow(name):
    data = yaml.safe_load((ROOT / '.github/workflows' / name).read_text())
    data['on'] = data.pop(True, data.get('on'))
    return data

