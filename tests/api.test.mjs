// Local API tests for worker.js using an in-memory KV mock.
// Run: node --test tests/
// NOTE: these verify application logic only. They do NOT prove that real
// Cloudflare KV storage works; see docs/TEST_PLAN.md for deployed tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../application/worker.js";

function makeKV() {
  const store = new Map();
  return {
    async get(key, type) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix = "" } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

const env = { TASKS_KV: makeKV() };
const BASE = "https://example.test";

async function call(method, path, body, headers = { "Content-Type": "application/json" }) {
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await worker.fetch(new Request(BASE + path, init), env);
  return { status: res.status, json: await res.json().catch(() => null), res };
}

let id;

test("POST /api/tasks creates a task", async () => {
  const r = await call("POST", "/api/tasks", { title: "  Write report ", priority: "High" });
  assert.equal(r.status, 201);
  assert.equal(r.json.success, true);
  assert.equal(r.json.data.title, "Write report");
  assert.equal(r.json.data.priority, "High");
  assert.equal(r.json.data.status, "Pending");
  assert.ok(r.json.data.createdAt);
  id = r.json.data.id;
});

test("defaults are applied", async () => {
  const r = await call("POST", "/api/tasks", { title: "Defaults" });
  assert.equal(r.json.data.priority, "Medium");
  assert.equal(r.json.data.status, "Pending");
});

test("GET /api/tasks lists tasks", async () => {
  const r = await call("GET", "/api/tasks");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.length, 2);
});

test("GET /api/tasks/:id returns one task", async () => {
  const r = await call("GET", `/api/tasks/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.id, id);
});

test("PUT /api/tasks/:id updates a task", async () => {
  const r = await call("PUT", `/api/tasks/${id}`, { status: "Completed", title: "Report v2" });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "Completed");
  assert.equal(r.json.data.title, "Report v2");
  assert.equal(r.json.data.id, id);
  assert.ok(r.json.data.updatedAt);
  const again = await call("GET", `/api/tasks/${id}`);
  assert.equal(again.json.data.status, "Completed");
});

test("DELETE /api/tasks/:id deletes a task", async () => {
  const r = await call("DELETE", `/api/tasks/${id}`);
  assert.equal(r.status, 200);
  const gone = await call("GET", `/api/tasks/${id}`);
  assert.equal(gone.status, 404);
});

test("nonexistent task returns 404", async () => {
  const missing = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal((await call("GET", `/api/tasks/${missing}`)).status, 404);
  assert.equal((await call("PUT", `/api/tasks/${missing}`, { title: "x" })).status, 404);
  assert.equal((await call("DELETE", `/api/tasks/${missing}`)).status, 404);
});

test("invalid task ID returns 400", async () => {
  assert.equal((await call("GET", "/api/tasks/not-a-uuid")).status, 400);
});

test("invalid data is rejected with 400", async () => {
  assert.equal((await call("POST", "/api/tasks", {})).status, 400);
  assert.equal((await call("POST", "/api/tasks", { title: "   " })).status, 400);
  assert.equal((await call("POST", "/api/tasks", { title: 42 })).status, 400);
  assert.equal((await call("POST", "/api/tasks", { title: "x", priority: "Urgent" })).status, 400);
  assert.equal((await call("POST", "/api/tasks", { title: "x", status: "Done" })).status, 400);
  assert.equal((await call("POST", "/api/tasks", { title: "a".repeat(121) })).status, 400);
  assert.equal((await call("POST", "/api/tasks", "{bad json")).status, 400);
  assert.equal((await call("POST", "/api/tasks", [1, 2])).status, 400);
});

test("wrong content type returns 415", async () => {
  const r = await call("POST", "/api/tasks", "title=x", { "Content-Type": "text/plain" });
  assert.equal(r.status, 415);
});

test("unsupported methods return 405 with Allow header", async () => {
  const a = await call("PATCH", "/api/tasks", { title: "x" });
  assert.equal(a.status, 405);
  assert.ok(a.res.headers.get("Allow"));
  const b = await call("POST", "/api/tasks/123e4567-e89b-42d3-a456-426614174000", { title: "x" });
  assert.equal(b.status, 405);
  assert.equal((await call("DELETE", "/api/tasks")).status, 405);
});

test("unknown API route returns 404, CORS preflight returns 204", async () => {
  assert.equal((await call("GET", "/api/other")).status, 404);
  const pre = await worker.fetch(new Request(BASE + "/api/tasks", { method: "OPTIONS" }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "*");
});

test("missing KV binding yields a 500 JSON error", async () => {
  const res = await worker.fetch(new Request(BASE + "/api/tasks"), {});
  assert.equal(res.status, 500);
  assert.equal((await res.json()).success, false);
});

test("health endpoint reports KV binding", async () => {
  const r = await call("GET", "/api/health");
  assert.equal(r.json.data.kvBound, true);
});
