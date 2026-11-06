// Regression guard for the v0.3.22 Windows black screen and the #1159 TDZ crash.
//
// The bootstrap splash rendered a blank window on the shipped production build
// because a derived top-level `const` read a hook result BEFORE that hook was
// declared:
//
//     const derived = f(logs);
//     const [logs, setLogs] = useState([]);
//
// The production minifier (esbuild) merges consecutive declarations into one
// comma-list and can hoist the read ahead of the binding, which throws a
// temporal-dead-zone ReferenceError during render. React unmounts to an empty
// #root and the whole app goes black. Dev builds short-circuit on `isFailed`,
// so only the minified release bundle tripped it.
//
// This guard checks the rule generically, so it does not depend on any one
// derived name: a top-level non-function `const` must not reference a hook
// binding declared later in the component. Closures (arrow functions and
// `function` expressions) run after render and are exempt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOOK = /^\s*const (\[[^\]]+\]|\w+) = use(State|Ref|Reducer)\(/;

/** Lines of hazard: a derived const that reads a hook binding declared after it. */
export function hookOrderHazards(text) {
  const lines = text.split('\n');
  const bindings = new Map();
  lines.forEach((line, index) => {
    const match = HOOK.exec(line);
    if (!match) return;
    for (const name of match[1].replace(/[[\]]/g, '').split(',').map((part) => part.trim())) {
      bindings.set(name, index);
    }
  });
  const hazards = [];
  lines.forEach((line, index) => {
    if (!/^  const /.test(line) || HOOK.test(line)) return;
    let statement = line;
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^  \S/.test(lines[next]) || /^}/.test(lines[next])) break;
      statement += `\n${lines[next]}`;
    }
    if (/=>|\bfunction\b/.test(statement)) return;
    for (const [name, at] of bindings) {
      if (at > index && new RegExp(`\\b${name}\\b`).test(statement)) {
        hazards.push(`line ${index + 1} reads "${name}" declared at line ${at + 1}`);
      }
    }
  });
  return hazards;
}

test('BootstrapSplash: no derived const reads a hook binding declared after it', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../electron/src/shared/components/BootstrapSplash.jsx', import.meta.url)),
    'utf8',
  );
  const start = source.indexOf('export function BootstrapSplash(');
  assert.ok(start > 0, "component 'export function BootstrapSplash(' not found — update this guard.");
  assert.deepEqual(
    hookOrderHazards(source.slice(start)),
    [],
    'Declare every useState/useRef before any derived const that reads it. Otherwise the production minifier hoists the read ahead of the binding → "Cannot access … before initialization" → black screen (v0.3.22).',
  );
});

test('the guard flags a derived const that reads a hook before it is declared', () => {
  const hazardous = [
    'export function Splash() {',
    '  const derived = f(logs);',
    '  const [logs, setLogs] = useState([]);',
    '}',
  ].join('\n');
  assert.equal(hookOrderHazards(hazardous).length, 1);
});

test('the guard allows closures that read a hook declared later', () => {
  const closure = [
    'export function Splash() {',
    '  const handle = () => setLogs([]);',
    '  const [logs, setLogs] = useState([]);',
    '}',
  ].join('\n');
  assert.deepEqual(hookOrderHazards(closure), []);
});
