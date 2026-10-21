"""Long production tool rounds carrying all twelve observed metadata fields."""
import importlib.util
from pathlib import Path

from metadata_fixture import annotate

source = Path(__file__).resolve().parents[2] / '2026-10-21-workbuddy-long-context' / 'qualify_long_context.py'
spec = importlib.util.spec_from_file_location('long_qualification', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.annotate = annotate

if __name__ == '__main__':
    raise SystemExit(module.main())
