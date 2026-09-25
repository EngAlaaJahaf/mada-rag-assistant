# Isolated Windows executable build

Build source: this project directory, not `C:\mada-rag`.

```powershell
python -m venv .venv-build
.\.venv-build\Scripts\python.exe -m pip install -r requirements-build.lock.txt
.\.venv-build\Scripts\python.exe build_exe.py
.\dist\mada-rag-server.exe --self-test
```

The build uses only python-docx, python-pptx, openpyxl, pypdf,
scikit-learn, their dependencies, and PyInstaller. Tcl/Tk from Python is
bundled for the background hotkey agent. No system site-packages are used.
`requirements-build.txt` lists direct requirements; the lock file records
the versions of the successful build.

## Output

Distribute the `dist` directory together: executable, `index.html`,
`chat.html`, and `static`. Python and the document/search libraries are
embedded in the executable. Mutable application data is stored beside it.
The embedded background agent is launched using `--background-agent`.

Local generation additionally requires these external files next to the EXE:

```
portable/llama/llama-server.exe
portable/llama/<matching runtime DLLs>
portable/models/model.gguf
```

The current build does not copy the multi-gigabyte model/backend, existing
conversations, uploads, or machine-specific configuration into `dist`.
The optional Argos translation bridge still requires the separately configured
translation environment and language models; it is not bundled in this build.
Backend compatibility (CUDA driver/GPU or CPU backend) must be checked on the
destination machine.

## Verification

Local generation now starts automatically on `127.0.0.1:8081` when a local
request arrives. The low profile uses CPU (`ngl=0`) and a 1024-token context.
Relative model/backend paths are resolved beside the application before
launching the child from its backend directory. Saved local 8080 endpoints
are routed to the managed 8081 backend for backward compatibility.
Startup failures report diagnostic details from `llama-server.log` beside
the executable. The log is replaced on each new backend launch.

Run startup regression tests without launching the backend:

```powershell
.\.venv-build\Scripts\python.exe -m unittest test_llm_startup -v
```

`--self-test` tests bundled document libraries, a PDF read/write round trip,
TF-IDF, Tcl initialization, and HTTP responses for `/` and `/chat` using an
ephemeral port. It neither restarts the running app nor starts generation.
It passed for the executable with Python removed from PATH. This is not a
test of model generation or global hotkeys on another computer.

One-file executables need writable temporary space for extraction. The build
uses `build-temp` on the project drive; the output executable normally uses
the destination machine's TEMP directory.
