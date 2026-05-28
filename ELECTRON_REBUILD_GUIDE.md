# Electron Rebuild Guide — better-sqlite3

## Why This Step Is Required

`better-sqlite3` is a native Node.js module (written in C++).
It must be compiled specifically for the exact version of Node.js that Electron bundles internally.
If you skip this step, the app will crash immediately on launch with a "invalid ELF header" or
"NODE_MODULE_VERSION mismatch" error.

## Setup Steps (run once after cloning or after `npm install`)

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Rebuild better-sqlite3 for Electron
```bash
npm run rebuild
```

This runs:
```
electron-rebuild -f -w better-sqlite3
```

`-f` forces a full rebuild even if already compiled.
`-w better-sqlite3` specifies the module to rebuild.

### Step 3 — Start the app
```bash
npm run dev
```

This starts the Vite dev server and launches Electron simultaneously via `vite-plugin-electron`.
The Electron window should open showing the Phase 1a-i-B health check screen.

## If You See Errors

### "Could not locate the bindings file"
→ Run `npm run rebuild` again. Make sure `electron` is installed in node_modules.

### "The module was compiled against a different Node.js version"
→ Run `npm run rebuild`. This error means better-sqlite3 was compiled for Node not Electron.

### "ELECTRON_RUN_AS_NODE" or missing electron binary
→ Run `npm install` first, then `npm run rebuild`.

### Prebuilt binaries — alternative approach
If compilation fails (requires Python + node-gyp build tools), you can try:
```bash
npm install --ignore-scripts
npm run rebuild
```
Or install build tools via:
```bash
npm install --global windows-build-tools
```
(Run in Administrator PowerShell on Windows)

## Verification

After successful rebuild, you should see:
```
✓ Rebuild Complete
```

Then `npm run dev` should open the Electron window with all 5 health checks showing green.
