/**
 * Student Task Manager - Cloudflare Worker (REST API)
 *
 * Static frontend files (application/public) are served by Workers Static Assets.
 * Any request that does not match a static file reaches this Worker, which
 * implements the REST API under /api/tasks and stores data in Workers KV.
 *
 * KV binding (declared in Terraform): TASKS_KV
 *
 * Task record (stored as JSON under key "task:<id>"):
 *   {
 *     id:        string  (UUID v4)
 *     title:     string  (1-120 chars)
 *     priority:  "High" | "Medium" | "Low"
 *     status:    "Pending" | "Completed"
 *     createdAt: string  (ISO 8601 timestamp)
 *     updatedAt: string  (ISO 8601 timestamp, set on update)
 *   }
 */

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Pending", "Completed"];
const KEY_PREFIX = "task:";
const MAX_TITLE = 120;
const MAX_BODY_BYTES = 10 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

const ok = (data, status = 200) => json({ success: true, data }, status);
const fail = (message, status, extraHeaders = {}) =>
  json({ success: false, error: message }, status, extraHeaders);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body;
}

/** Validate task fields. When `partial` is false, title is required. */
function validate(body, { partial }) {
  const errors = [];
  const out = {};

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      errors.push("title is required and must be a non-empty string");
    } else if (body.title.trim().length > MAX_TITLE) {
      errors.push(`title must be at most ${MAX_TITLE} characters`);
    } else {
      out.title = body.title.trim();
    }
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      errors.push(`priority must be one of: ${PRIORITIES.join(", ")}`);
    } else out.priority = body.priority;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      errors.push(`status must be one of: ${STATUSES.join(", ")}`);
    } else out.status = body.status;
  }
  if (errors.length) throw new HttpError(400, errors.join("; "));
  return out;
}

function checkId(id) {
  if (!UUID_RE.test(id)) throw new HttpError(400, "Invalid task ID format");
  return id;
}

async function getTask(env, id) {
  const task = await env.TASKS_KV.get(KEY_PREFIX + id, "json");
  if (!task) throw new HttpError(404, "Task not found");
  return task;
}

async function listTasks(env) {
  const tasks = [];
  let cursor;
  do {
    const page = await env.TASKS_KV.list({ prefix: KEY_PREFIX, cursor });
    const items = await Promise.all(
      page.keys.map((k) => env.TASKS_KV.get(k.name, "json"))
    );
    for (const t of items) if (t) tasks.push(t);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  tasks.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
  return tasks;
}

async function handleApi(request, env, url) {
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api","tasks",id?]
  if (parts[0] !== "api" || parts[1] !== "tasks" || parts.length > 3) {
    throw new HttpError(404, "Route not found");
  }
  if (!env.TASKS_KV) throw new Error("KV binding TASKS_KV is not configured");

  const id = parts[2];
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (!id) {
    if (method === "GET") return ok(await listTasks(env));
    if (method === "POST") {
      const fields = validate(await readJson(request), { partial: false });
      const task = {
        id: crypto.randomUUID(),
        title: fields.title,
        priority: fields.priority ?? "Medium",
        status: fields.status ?? "Pending",
        createdAt: new Date().toISOString(),
      };
      await env.TASKS_KV.put(KEY_PREFIX + task.id, JSON.stringify(task));
      return ok(task, 201);
    }
    return fail("Method not allowed", 405, { Allow: "GET, POST, OPTIONS" });
  }

  checkId(id);
  if (method === "GET") return ok(await getTask(env, id));
  if (method === "PUT") {
    const existing = await getTask(env, id);
    const fields = validate(await readJson(request), { partial: true });
    const updated = {
      ...existing,
      ...fields,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await env.TASKS_KV.put(KEY_PREFIX + id, JSON.stringify(updated));
    return ok(updated);
  }
  if (method === "DELETE") {
    await getTask(env, id); // 404 if missing
    await env.TASKS_KV.delete(KEY_PREFIX + id);
    return ok({ id, deleted: true });
  }
  return fail("Method not allowed", 405, { Allow: "GET, PUT, DELETE, OPTIONS" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") {
        return ok({ status: "ok", kvBound: Boolean(env.TASKS_KV) });
      }
      if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
        return await handleApi(request, env, url);
      }
      // Non-API paths that were not served as static assets.
      return fail("Not found", 404);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status);
      console.error("Unhandled error:", err && err.message);
      return fail("Internal server error", 500);
    }
  },
};
