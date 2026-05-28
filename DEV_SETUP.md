# cQikly — Dev Setup (Read This First)

## First time setup / after cloning / after `npm install`

```bash
npm install
npm run rebuild     # ← REQUIRED: rebuilds better-sqlite3 for your Electron version
npm run dev
```

**If you skip `npm run rebuild`, the DB will never initialize.**
You'll see `no such table: bills`, `Database not initialized`, etc.
These are symptoms of a missing rebuild — not app bugs.

## One-command shortcut (rebuild + dev together)

```bash
npm run dev:fresh   # does rebuild + vite in sequence
```

## When to re-run `npm run rebuild`

- After `npm install` (anytime node_modules changes)
- After updating Electron version in package.json
- After switching Node.js versions
- After pulling changes that touch package.json

## Why this is needed

`better-sqlite3` is a native C++ Node module. It must be compiled for the
exact version of Electron's Node.js runtime — not your system Node.js.
`electron-rebuild` does this compilation. Without it, the module either
fails to load or segfaults, and the DB connection is never opened.

## Symptoms of a missing rebuild

- `[cQikly] FATAL: DB migration / initialization failed` in the Electron console
- `Error invoking remote method 'db:run': Database not initialized`
- `SqliteError: no such table: bills` (or any table)
- `SqliteError: no such table: company_profile`
- Onboarding setup save fails immediately
