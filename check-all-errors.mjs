#!/usr/bin/env node
/**
 * check-all-errors.mjs
 * Run ALL TypeScript checks in one shot — renderer + electron/main.
 * Shows every error before you waste time running electron-builder.
 *
 * Usage:
 *   node check-all-errors.mjs          # just type-check (use this for packaging)
 *   node check-all-errors.mjs --lint   # type-check + eslint (only if .eslintrc exists)
 *   node check-all-errors.mjs --build  # type-check + full build (no package)
 */

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

const args    = process.argv.slice(2);
const doLint  = args.includes("--lint");
const doBuild = args.includes("--build");

// ─── helpers ──────────────────────────────────────────────────────────────────

function header(title) {
  const line = "─".repeat(60);
  console.log(`\n${CYAN}${BOLD}${line}\n  ${title}\n${line}${RESET}`);
}

function run(label, cmd) {
  const start = Date.now();
  console.log(`${YELLOW}▶ ${label}${RESET}`);
  const result = spawnSync(cmd, {
    shell: true, cwd: ROOT, encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const output  = (result.stdout || "") + (result.stderr || "");
  const ok = result.status === 0;
  console.log(ok
    ? `${GREEN}✔ ${label} — passed (${elapsed}s)${RESET}`
    : `${RED}✘ ${label} — FAILED (${elapsed}s)${RESET}`);
  return { ok, output, label };
}

// ─── checks ───────────────────────────────────────────────────────────────────

const results = [];

header("1 / 2  —  Renderer type-check  (tsconfig.json)");
results.push(run("tsc renderer", "npx tsc --noEmit -p tsconfig.json"));

header("2 / 2  —  Electron/main type-check  (tsconfig.electron.json)");
results.push(run("tsc electron", "npx tsc --noEmit -p tsconfig.electron.json"));

if (doLint) {
  // Only run eslint if a config file actually exists
  const hasEslintConfig =
    existsSync(`${ROOT}/.eslintrc`) ||
    existsSync(`${ROOT}/.eslintrc.js`) ||
    existsSync(`${ROOT}/.eslintrc.cjs`) ||
    existsSync(`${ROOT}/.eslintrc.json`) ||
    existsSync(`${ROOT}/.eslintrc.yml`) ||
    existsSync(`${ROOT}/eslint.config.js`) ||
    existsSync(`${ROOT}/eslint.config.mjs`);

  if (hasEslintConfig) {
    header("ESLint");
    results.push(run("eslint", "npx eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"));
  } else {
    console.log(`\n${YELLOW}⚠ --lint flag ignored: no ESLint config file found in project root.${RESET}`);
  }
}

if (doBuild) {
  header("Build (vite + tsc emit)");
  results.push(run("vite build",     "npm run build:vite"));
  results.push(run("electron build", "npm run build:electron"));
}

// ─── summary ──────────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok);
const passed = results.filter(r =>  r.ok);

console.log(`\n${BOLD}${"═".repeat(60)}\n  SUMMARY\n${"═".repeat(60)}${RESET}`);
console.log(`  ${GREEN}Passed:${RESET} ${passed.length}   ${RED}Failed:${RESET} ${failed.length}`);

if (failed.length === 0) {
  console.log(`\n${GREEN}${BOLD}  ✔ All checks passed — safe to run npm run package!${RESET}\n`);
  process.exit(0);
}

failed.forEach(({ label, output }) => {
  console.log(`\n${RED}${BOLD}${"─".repeat(60)}\n  ERRORS from: ${label}\n${"─".repeat(60)}${RESET}`);
  console.log(output.trim());
});

// ─── quick-fix hints ──────────────────────────────────────────────────────────

const combined = failed.map(r => r.output).join("\n");

console.log(`\n${YELLOW}${BOLD}${"─".repeat(60)}\n  COMMON-FIX HINTS\n${"─".repeat(60)}${RESET}`);

if (combined.includes("ignoreDeprecations")) {
  console.log(`${YELLOW}▸ tsconfig.json still has "ignoreDeprecations": "6.0" — delete that line${RESET}`);
}
if (combined.includes("pageSize") && combined.includes("PrintToPDFOptions")) {
  console.log(`${YELLOW}▸ pageSize cast in pdf.handler.ts — use: pageSize as ElectronPageSize${RESET}`);
}
if (combined.includes("marginsType")) {
  console.log(`${YELLOW}▸ marginsType removed in Electron 31 — delete those lines in pdf.handler.ts${RESET}`);
}
if (combined.includes("noUnusedLocals") || combined.includes("is declared but")) {
  console.log(`${YELLOW}▸ Unused variables/imports — remove them or prefix with _${RESET}`);
}
if (combined.includes("implicitly has an 'any' type")) {
  console.log(`${YELLOW}▸ Implicit 'any' — add explicit type annotations${RESET}`);
}
if (combined.includes("await") && combined.includes("async")) {
  console.log(`${YELLOW}▸ 'await' outside async function — add async to the enclosing function${RESET}`);
}
if (combined.includes("Buffer")) {
  console.log(`${YELLOW}▸ 'Buffer' not in renderer scope — replace with Uint8Array${RESET}`);
}

console.log(`\n${RED}${BOLD}  ✘ Fix the errors above, then re-run this script before packaging.${RESET}\n`);
process.exit(1);
