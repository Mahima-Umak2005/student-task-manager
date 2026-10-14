// Student Task Manager - frontend. All data goes through the REST API
// (same origin as the Worker); nothing is stored in the browser.
const API = "/api/tasks";

const $ = (id) => document.getElementById(id);
const form = $("task-form");
const listEl = $("task-list");
let tasks = [];
let toastTimer;

function toast(message, type = "success") {
  const el = $("toast");
  el.textContent = message;
  el.className = "toast " + type;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

function setLoading(on) {
  $("loading").hidden = !on;
}

async function api(path = "", options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Network error: could not reach the server");
  }
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !payload || payload.success === false) {
    throw new Error((payload && payload.error) || `Request failed (${res.status})`);
  }
  return payload.data;
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const fs = $("filter-status").value;
  const fp = $("filter-priority").value;
  const shown = tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!fs || t.status === fs) &&
      (!fp || t.priority === fp)
  );

  listEl.replaceChildren();
  $("empty").hidden = shown.length > 0;

  for (const t of shown) {
    const li = document.createElement("li");
    li.className = "task" + (t.status === "Completed" ? " done" : "");

    const main = document.createElement("div");
    main.className = "task-main";
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = t.title; // textContent avoids HTML injection
    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.append(
      badge(t.priority, t.priority),
      badge(t.status, t.status === "Completed" ? "Completed" : ""),
      document.createTextNode("Created " + formatDate(t.createdAt))
    );
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.append(
      button("View", () => viewTask(t.id)),
      button("Edit", () => startEdit(t)),
      button(t.status === "Completed" ? "Reopen" : "Done", () => toggleStatus(t)),
      button("Delete", () => removeTask(t), "danger")
    );

    li.append(main, actions);
    listEl.append(li);
  }
}

function badge(text, cls) {
  const s = document.createElement("span");
  s.className = "badge " + cls;
  s.textContent = text;
  return s;
}

function button(label, onClick, extra = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn small " + extra;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

async function loadTasks() {
  setLoading(true);
  try {
    tasks = await api();
    render();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    setLoading(false);
  }
}

function resetForm() {
  form.reset();
  $("task-id").value = "";
  $("form-title").textContent = "Add a task";
  $("save-btn").textContent = "Add task";
  $("cancel-btn").hidden = true;
}

function startEdit(t) {
  $("task-id").value = t.id;
  $("title").value = t.title;
  $("priority").value = t.priority;
  $("status").value = t.status;
  $("form-title").textContent = "Edit task";
  $("save-btn").textContent = "Save changes";
  $("cancel-btn").hidden = false;
  $("title").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function viewTask(id) {
  try {
    const t = await api("/" + encodeURIComponent(id));
    const dl = $("detail");
    dl.replaceChildren();
    const rows = [
      ["ID", t.id],
      ["Title", t.title],
      ["Priority", t.priority],
      ["Status", t.status],
      ["Created", formatDate(t.createdAt)],
    ];
    if (t.updatedAt) rows.push(["Updated", formatDate(t.updatedAt)]);
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    $("detail-card").hidden = false;
    $("detail-card").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    toast(e.message, "error");
  }
}

async function toggleStatus(t) {
  const status = t.status === "Completed" ? "Pending" : "Completed";
  try {
    await api("/" + encodeURIComponent(t.id), {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    toast(`Task marked ${status}`);
    await loadTasks();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function removeTask(t) {
  if (!confirm(`Delete "${t.title}"?`)) return;
  try {
    await api("/" + encodeURIComponent(t.id), { method: "DELETE" });
    toast("Task deleted");
    if (!$("detail-card").hidden) $("detail-card").hidden = true;
    await loadTasks();
  } catch (e) {
    toast(e.message, "error");
  }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const title = $("title").value.trim();
  if (!title) return toast("Please enter a title", "error");

  const body = JSON.stringify({
    title,
    priority: $("priority").value,
    status: $("status").value,
  });
  const id = $("task-id").value;
  const btn = $("save-btn");
  btn.disabled = true;
  try {
    if (id) {
      await api("/" + encodeURIComponent(id), { method: "PUT", body });
      toast("Task updated");
    } else {
      await api("", { method: "POST", body });
      toast("Task created");
    }
    resetForm();
    await loadTasks();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    btn.disabled = false;
  }
});

$("cancel-btn").addEventListener("click", resetForm);
$("refresh-btn").addEventListener("click", loadTasks);
$("close-detail").addEventListener("click", () => ($("detail-card").hidden = true));
["search", "filter-status", "filter-priority"].forEach((id) =>
  $(id).addEventListener("input", render)
);

loadTasks();
