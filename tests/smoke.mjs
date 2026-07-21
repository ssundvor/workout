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

const emptyStorage = new Map();
const empty = boot(emptyStorage);
clickButton(empty, { preview: "monday", previewWeek: "1" });
clickButton(empty, { start: "monday", startWeek: "1" });
clickButton(empty, {}, ["data-pause"]);
const emptyState = JSON.parse(emptyStorage.get("vanity-sprint-v1"));
assert.equal(emptyState.active, null);
assert.deepEqual(emptyState.paused, []);
assert.doesNotMatch(empty.app.innerHTML, /Resume/);

const storage = new Map();
let env = boot(storage);
assert.match(env.app.innerHTML, /Vanity Sprint/);

for (let index = 0; index < 3; index += 1) clickButton(env, { week: "1" });
assert.match(env.app.innerHTML, /Week 4 of 8/);

const beforePreview = storage.get("vanity-sprint-v1");
clickButton(env, { preview: "monday", previewWeek: "4" });
assert.match(env.app.innerHTML, /Week 4 · Preview/);
assert.match(env.app.innerHTML, /Incline DB curl/);
assert.match(env.app.innerHTML, /4 × 10 reps/);
assert.equal(storage.get("vanity-sprint-v1"), beforePreview, "preview does not create an active workout");

clickButton(env, { start: "monday", startWeek: "4" });
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

clickButton(env, {}, ["data-pause"]);
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active, null);
assert.equal(persisted.paused[0].workoutId, "monday");
assert.equal(persisted.paused[0].entries["mon-incline-press:1"].weight, "40");
assert.match(env.app.innerHTML, /Monday · Resume/);
assert.match(env.app.innerHTML, /data-preview="tuesday"/);

clickButton(env, { start: "monday", startWeek: "4" });
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.workoutId, "monday");
assert.equal(persisted.active.entries["mon-incline-press:1"].weight, "40");

clickButton(env, {}, ["data-pause"]);
clickButton(env, { week: "1" });
clickButton(env, { preview: "thursday", previewWeek: "5" });
clickButton(env, { start: "thursday", startWeek: "5" });
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.workoutId, "thursday");
assert.equal(persisted.active.week, 5);
assert.equal(persisted.paused[0].workoutId, "monday");
assert.equal(persisted.paused[0].week, 4);

const thursdayWeight = { value: "45", classList: classList(), focus() {} };
const thursdayReps = { value: "10", classList: classList(), focus() {} };
const thursdayRow = { querySelector: selector => selector.includes("weight") ? thursdayWeight : thursdayReps };
const thursdayLog = {
  dataset: { log: "thu-db-row:1" },
  closest(selector) { return selector === "button" ? thursdayLog : thursdayRow; },
  hasAttribute() { return false; }
};
env.click(thursdayLog);
clickButton(env, {}, ["data-pause"]);
clickButton(env, { week: "-1" });
clickButton(env, { start: "monday", startWeek: "4" });
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.workoutId, "monday");
assert.equal(persisted.active.entries["mon-incline-press:1"].weight, "40");
assert.equal(persisted.paused[0].workoutId, "thursday");

env = boot(storage);
assert.match(env.app.innerHTML, /Monday: Chest \+ Arms \+ Delts/);
assert.match(env.app.innerHTML, /data-row="mon-incline-press:1"[\s\S]*?value="40"/);
assert.match(env.app.innerHTML, /data-log="mon-incline-press:1"[\s\S]*?>Edit<\/button>/);

clickButton(env, { log: "mon-incline-press:1" });
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.entries["mon-incline-press:1"], undefined);
assert.deepEqual(persisted.active.drafts["mon-incline-press:1"], { weight: "40", reps: "10" });
assert.match(env.app.innerHTML, /data-row="mon-incline-press:1"[\s\S]*?value="40"/);

weightInput.value = "42.5";
repsInput.value = "8";
env.click(logButton);
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active.entries["mon-incline-press:1"].weight, "42.5");
assert.equal(persisted.active.entries["mon-incline-press:1"].reps, "8");

clickButton(env, {}, ["data-restart"]);
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.deepEqual(persisted.active.entries, {});
assert.deepEqual(persisted.active.drafts, {});
assert.equal(persisted.active.startedAt, null);
assert.equal(persisted.active.timer, null);
assert.match(env.confirmPrompt, /Start Monday over/);

weightInput.value = "40";
repsInput.value = "10";
env.click(logButton);

clickButton(env, {}, ["data-finish"]);
persisted = JSON.parse(storage.get("vanity-sprint-v1"));
assert.equal(persisted.active, null);
assert.equal(persisted.sessions.length, 1);
assert.match(env.confirmPrompt, /sets not logged/);

clickButton(env, { screen: "history" });
assert.match(env.app.innerHTML, /History/);
assert.match(env.app.innerHTML, /40 lb × 10/);

clickButton(env, { screen: "home" });
clickButton(env, { preview: "monday", previewWeek: "4" });
clickButton(env, { start: "monday", startWeek: "4" });
assert.match(env.app.innerHTML, /data-row="mon-incline-press:1"[\s\S]*?value="40"/);

const deloadStorage = new Map([["vanity-sprint-v1", JSON.stringify({ week: 8, active: null, sessions: [] })]]);
const deload = boot(deloadStorage);
clickButton(deload, { preview: "tuesday", previewWeek: "8" });
assert.match(deload.app.innerHTML, /Deload:/);
assert.match(deload.app.innerHTML, /2 × 5–8 reps/);
assert.doesNotMatch(deload.app.innerHTML, /data-row=/);
clickButton(deload, { start: "tuesday", startWeek: "8" });
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

const recoveryStorage = new Map([
  ["vanity-sprint-v1", JSON.stringify({
    week: 1,
    active: null,
    paused: [{ id: "empty-old", workoutId: "tuesday", week: 1, entries: {}, drafts: {} }],
    sessions: []
  })],
  ["sprint-tracker-v1", JSON.stringify({
    week: 1,
    timer: null,
    sessions: [{
      id: "recovered-yesterday",
      date: "2026-07-20",
      workoutId: "mon",
      week: 1,
      createdAt: new Date("2026-07-20T18:00:00Z").getTime(),
      startedAt: new Date("2026-07-20T18:01:00Z").getTime(),
      finishedAt: new Date("2026-07-20T18:45:00Z").getTime(),
      sets: { "mon1|1": { w: 50, r: 10, ts: new Date("2026-07-20T18:05:00Z").getTime() } },
      drafts: {}
    }]
  })]
]);
const recovered = boot(recoveryStorage);
const recoveredState = JSON.parse(recoveryStorage.get("vanity-sprint-v1"));
assert.equal(recoveredState.paused.length, 0, "empty paused workouts are cleaned up on load");
assert.equal(recoveredState.sessions.length, 1);
assert.equal(recoveredState.sessions[0].entries["mon-incline-press:1"].weight, "50");
assert.match(recovered.app.innerHTML, /Recovered:<\/strong> 1 workout/);
assert.match(recovered.app.innerHTML, /History \(1\)/);

console.log("Workout flow smoke tests: OK");
