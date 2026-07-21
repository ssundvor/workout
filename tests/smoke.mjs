import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    toggle: (name, force) => force === undefined ? (values.has(name) ? !values.delete(name) : !!values.add(name)) : (force ? !!values.add(name) : !values.delete(name)),
    contains: name => values.has(name)
  };
}

function boot(seed = new Map()) {
  const listeners = {};
  const app = { className: "shell", classList: classList(), innerHTML: "" };
  const toast = { textContent: "", classList: classList() };
  let confirmPrompt = "";
  const localStorage = {
    getItem: key => seed.get(key) ?? null,
    setItem: (key, value) => seed.set(key, value)
  };
  const document = {
    body: { classList: classList() },
    getElementById: id => id === "app" ? app : id === "toast" ? toast : null,
    querySelector: () => null,
    addEventListener: (type, handler) => { listeners[type] = handler; }
  };
  const context = {
    console,
    document,
    localStorage,
    navigator: {},
    location: { protocol: "file:" },
    window: {
      addEventListener() {},
      confirm(prompt) { confirmPrompt = prompt; return true; }
    },
    CSS: { escape: value => String(value) },
    Date,
    Intl,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    structuredClone,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: handler => { handler(); return 1; },
    clearTimeout: () => {}
  };
  vm.runInNewContext(script, context);
  const click = target => listeners.click({ target });
  return { app, click, seed, get confirmPrompt() { return confirmPrompt; } };
}

function clickButton(env, dataset = {}, attributes = []) {
  const target = {
    dataset,
    closest(selector) { return selector === "button" ? target : null; },
    hasAttribute: name => attributes.includes(name)
  };
  env.click(target);
}

const storage = new Map();
let env = boot(storage);
assert.match(env.app.innerHTML, /Vanity Sprint/);

for (let index = 0; index < 3; index += 1) clickButton(env, { week: "1" });
assert.match(env.app.innerHTML, /Week 4 of 8/);

clickButton(env, { start: "monday" });
assert.match(env.app.innerHTML, /Monday: Chest \+ Arms \+ Delts/);
assert.equal((env.app.innerHTML.match(/data-row="mon-incline-curl:/g) || []).length, 4);
assert.equal((env.app.innerHTML.match(/data-row="mon-overhead-extension:/g) || []).length, 4);
assert.equal((env.app.innerHTML.match(/data-row="mon-calf-raise:/g) || []).length, 4);

const curlOne = env.app.innerHTML.indexOf('data-row="mon-incline-curl:1"');
const extensionOne = env.app.innerHTML.indexOf('data-row="mon-overhead-extension:1"');
const curlTwo = env.app.innerHTML.indexOf('data-row="mon-incline-curl:2"');
assert.ok(curlOne < extensionOne && extensionOne < curlTwo, "superset rows alternate");

const weightInput = { value: "40", classList: classList(), focus() {} };
const repsInput = { value: "10", classList: classList(), focus() {} };
const row = { querySelector: selector => selector.includes("weight") ? weightInput : repsInput };
const logButton = {
  dataset: { log: "mon-incline-press:1" },
  closest(selector) { return selector === "button" ? logButton : row; },
  hasAttribute() { return false; }
};
env.click(logButton);

let persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.entries["mon-incline-press:1"].weight, "40");
assert.equal(persisted.active.entries["mon-incline-press:1"].reps, "10");
assert.equal(persisted.active.timer.duration, 150);
assert.match(persisted.active.timer.nextLabel, /set 2/);

env = boot(storage);
assert.match(env.app.innerHTML, /Monday: Chest \+ Arms \+ Delts/);
assert.match(env.app.innerHTML, /data-row="mon-incline-press:1"[\s\S]*?value="40"/);

clickButton(env, {}, ["data-finish"]);
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active, null);
assert.equal(persisted.sessions.length, 1);
assert.match(env.confirmPrompt, /sets not logged/);

clickButton(env, { screen: "history" });
assert.match(env.app.innerHTML, /History/);
assert.match(env.app.innerHTML, /40 lb × 10/);

clickButton(env, { screen: "home" });
clickButton(env, { start: "monday" });
assert.match(env.app.innerHTML, /data-row="mon-incline-press:1"[\s\S]*?value="40"/);

const deloadStorage = new Map([["vanity-sprint-v1", JSON.stringify({ week: 8, active: null, sessions: [] })]]);
const deload = boot(deloadStorage);
clickButton(deload, { start: "tuesday" });
assert.match(deload.app.innerHTML, /Deload:/);
assert.equal((deload.app.innerHTML.match(/data-row="tue-leg-press-calf:/g) || []).length, 2);
assert.doesNotMatch(deload.app.innerHTML, /data-row="tue-hack-squat:3"/);

const legacyStorage = new Map([["sprint-tracker-v1", JSON.stringify({
  week: 3,
  timer: { endsAt: Date.now() + 60000, next: "Next: Incline DB curl · set 1" },
  sessions: [{
    id: "legacy-session",
    date: "2026-07-20",
    workoutId: "mon",
    week: 3,
    createdAt: Date.now() - 5000,
    startedAt: Date.now() - 4000,
    finishedAt: null,
    sets: { "mon1|1": { w: 55, r: 9, ts: Date.now() - 3000 } },
    drafts: { "mon1|2": { w: "55", r: "8" } }
  }]
})]]);
const migrated = boot(legacyStorage);
const migratedState = JSON.parse(legacyStorage.get("vanity-sprint-v1"));
assert.equal(migratedState.active.workoutId, "monday");
assert.equal(migratedState.active.entries["mon-incline-press:1"].weight, "55");
assert.equal(migratedState.active.drafts["mon-incline-press:2"].reps, "8");
assert.match(migrated.app.innerHTML, /Monday: Chest \+ Arms \+ Delts/);

console.log("Workout flow smoke tests: OK");
