"""Run with .venv-build/Scripts/python.exe; never use system site-packages."""
from pathlib import Path
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
if sys.prefix == sys.base_prefix:
    raise SystemExit('Build requires the isolated .venv-build environment.')

temporary = ROOT / 'build-temp'
temporary.mkdir(exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(temporary)
os.environ['PYINSTALLER_CONFIG_DIR'] = str(temporary / 'pyinstaller-cache')

subprocess.run([
    sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile',
    '--name', 'mada-rag-server', '--distpath', str(ROOT / 'dist'),
    '--workpath', str(ROOT / 'build'), '--specpath', str(ROOT),
    str(ROOT / 'frozen_entry.py'),
], cwd=ROOT, check=True)

for name in ('index.html', 'chat.html'):
    shutil.copy2(ROOT / name, ROOT / 'dist' / name)
shutil.copytree(ROOT / 'static', ROOT / 'dist' / 'static', dirs_exist_ok=True)
packages = subprocess.check_output([sys.executable, '-m', 'pip', 'freeze'], text=True)
(ROOT / 'requirements-build.lock.txt').write_text(packages, encoding='utf-8')
print('BUILD COMPLETE:', ROOT / 'dist' / 'mada-rag-server.exe')
