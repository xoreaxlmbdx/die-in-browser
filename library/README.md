# die.js

## Methods

### `constructor(config)`

Creates a new instance of `DIEInBrowser`.

Example:

```js
const detectItEasy = window.DIE = new DIEInBrowser({
  wasm_path: "v86.wasm",
  bios: {
    url: "seabios.bin",
  },
  vga_bios: {
    url: "vgabios.bin",
  },
  initial_state: {
    url: "v86state.bin.zst",
  },
});
```

### `runCommand(command, callback)`

Executes a shell command inside the **V86** emulator.

The command’s output (excluding the shell prompt) is passed to the callback once
execution completes.

Example:

```js
detectItEasy.runCommand("./run_diec.sh -v", console.log);
// Output: "die 3.10"
```

### `analyzeFile(path, flags, callback)`

Runs a full analysis of a file inside the emulator using `diec` (Detect It Easy
in console).

This method:

1. Discovers which analysis methods are available for the file (e.g., PE
   sections, ELF headers).
2. Collects **detections**, **file info**, **hashes**, **entropy**, and
   **strings**.
3. Additionally fetches **entry point** and **sections (only for PE files)**
4. Calls `callback(type, data)` **multiple times**, once for each result type.

Parameters:

- `path` - path to the file inside the emulator (e.g., `/mnt/file.bin`).
- `flags` - extra `diec` flags (e.g., `d` for deep scan).
- `callback(type, data)` - receives results incrementally:
  - `"detects"`: main detections (via `diec`)
  - `"info"`: file type, architecture, etc. (via `diec`)
  - `"hashes"`: MD4, MD5, SHA1, SHA224, SHA256, SHA384, SHA512
  - `"entropy"`: file entropy
  - `"strings"`: extracted strings (a table of strings and their offsets)
  - `"entrypoint"`: entry point address (base address and entry point for PE
    files)
  - `"sections"`: section table (PE only)

Example:

```js
detectItEasy.analyzeFile("diec", "rd", (type, res) => {
  console.log(type, res);
});
```

### `createFileAndAnalyze(bytes, flags, callback)`

Uploads a file into the emulator and immediately calls `analyzeFile` on it.

- `bytes` - file content as a `Uint8Array`.
- Other parameters are identical to `analyzeFile`.

Example:

```js
const bytes = ...;
detectItEasy.createFileAndAnalyze(bytes, "rd", (type, res) => {
  console.log(type, res);
});
```

### `analyzeAdditionalInfo(path, methodsList, callback)`

Fetches **low-level structural details** of a binary (like entry point or
section headers) using format-specific `diec` methods.

This method is called internally by `analyzeFile` after the main analysis
completes. It only runs methods that are **actually applicable** to the file
(methods are fetched via `diec -m`).

Parameters:

- `path` - path to the file inside the emulator.
- `methodsList` - array of available scanner names (e.g., `"IMAGE_NT_HEADERS"`,
  `"Elf_Ehdr"`).
- `callback(type, data)` - same callback as in `analyzeFile`; will be called
  with:
  - `"entrypoint"` - entry point (and image base for PE files)
  - `"sections"` - section table (PE only)

You usually **don’t need to call this directly** unless you're doing custom
analysis.
