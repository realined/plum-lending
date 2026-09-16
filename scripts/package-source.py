"""Package reviewed source only. Never recursively zip the working directory."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
# Explicit manifest is deliberate: new local files cannot silently enter the submission.
manifest=root/'docs/source-manifest.txt'
files=[line.strip() for line in manifest.read_text().splitlines() if line.strip() and not line.startswith('#')]
output=root.parent/'plum-lending-source.zip'
with ZipFile(output,'w',ZIP_DEFLATED) as archive:
 for name in files:
  path=root/name
  if path.is_symlink() or not path.is_file() or '..' in Path(name).parts:
   raise RuntimeError('Source manifest contains an invalid path')
  if any(part in ('.data','.next','.git','node_modules','test-results','playwright-report') for part in Path(name).parts) or (path.name.startswith('.env') and path.name!='.env.example'):
   raise RuntimeError('Source manifest contains a private/runtime path')
  archive.write(path,Path('plum-lending')/name)
print('Created source-only archive; local configuration, runtime data and test traces excluded.')
