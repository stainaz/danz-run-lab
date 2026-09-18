const storageKey = "danz-run-lab-sessions";
const pendingKey = "danz-run-lab-pending-sessions";
const supabaseConfig = window.DANZ_SUPABASE;
const supabaseClient = window.supabase?.createClient(supabaseConfig.url, supabaseConfig.publishableKey);
const form = document.querySelector("#pace-form");
const distanceInputs = [...document.querySelectorAll('[name="distance"]')];
const timeInputs = ["hours", "minutes", "seconds"].map((id) => document.querySelector(`#${id}`));
const customWrap = document.querySelector("#custom-distance-wrap");
const customDistance = document.querySelector("#custom-distance");
const sessionDate = document.querySelector("#session-date");
const runnerName = document.querySelector("#runner-name");
const sessionDialog = document.querySelector("#session-dialog");
const sessionEditor = document.querySelector("#session-editor");
const adminDialog = document.querySelector("#admin-dialog");
let sessionsCache = [];
let isAdmin = false;
let installPrompt;
let toastTimer;

sessionDate.value = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDistance() {
  const selected = distanceInputs.find((input) => input.checked)?.value;
  return selected === "custom" ? Number(customDistance.value) : Number(selected);
}

function getTotalSeconds() {
  return Number(timeInputs[0].value) * 3600 + Number(timeInputs[1].value) * 60 + Number(timeInputs[2].value);
}

function formatDuration(totalSeconds, includeHours = false) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (includeHours || hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseDuration(value) {
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function calculatePlan() {
  const distance = getDistance();
  const totalSeconds = getTotalSeconds();
  const validTime = timeInputs.every((input) => input.validity.valid);
  const validDistance = Number.isFinite(distance) && distance > 0 && (customWrap.classList.contains("hidden") || customDistance.validity.valid);
  if (!validDistance || !validTime || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const paceSeconds = totalSeconds / distance;
  const speed = 3600 / paceSeconds;
  const splits = [];
  for (let kilometre = 1; kilometre <= Math.floor(distance); kilometre += 1) {
    splits.push({ label: `KM ${String(kilometre).padStart(2, "0")}`, elapsed: kilometre * paceSeconds });
  }
  if (distance % 1 !== 0) splits.push({ label: `${distance.toFixed(1)} KM`, elapsed: totalSeconds });
  return { distance, totalSeconds, paceSeconds, speed, splits };
}

function renderPlan() {
  const plan = calculatePlan();
  if (!plan) return;
  document.querySelector("#result-distance").textContent = `${plan.distance.toFixed(1)} KM`;
  document.querySelector("#pace-main").textContent = formatDuration(plan.paceSeconds);
  document.querySelector("#speed").textContent = `${plan.speed.toFixed(1)} km/h`;
  document.querySelector("#finish").textContent = formatDuration(plan.totalSeconds);
  document.querySelector("#splits").innerHTML = plan.splits
    .map((split) => `<li><span>${split.label}</span><strong>${formatDuration(split.elapsed, plan.totalSeconds >= 3600)}</strong></li>`)
    .join("");
}

function normalizeSession(session) {
  const distance = Number(session.distance ?? session.distance_km);
  const totalSeconds = Number(session.totalSeconds ?? session.target_seconds);
  const sourceActualSeconds = session.actualSeconds ?? session.actual_seconds;
  const actualSeconds = sourceActualSeconds ? Number(sourceActualSeconds) : null;
  return {
    ...session,
    id: String(session.id || makeId()),
    runner: String(session.runner || "Runner").slice(0, 40),
    date: session.date || session.session_date,
    distance,
    totalSeconds,
    paceSeconds: totalSeconds / distance,
    actualSeconds,
    status: actualSeconds ? "completed" : "planned",
    createdAt: session.createdAt || session.created_at || new Date().toISOString(),
  };
}

function isValidSession(session) {
  return session.date && Number.isFinite(session.distance) && session.distance >= 0.4 && session.distance <= 100
    && Number.isFinite(session.totalSeconds) && session.totalSeconds > 0
    && (!session.actualSeconds || Number.isFinite(session.actualSeconds) && session.actualSeconds > 0);
}

function getSessions() {
  return sessionsCache;
}

function toDatabaseSession(session) {
  return {
    id: session.id,
    runner: session.runner,
    session_date: session.date,
    distance_km: session.distance,
    target_seconds: Math.round(session.totalSeconds),
    actual_seconds: session.actualSeconds ? Math.round(session.actualSeconds) : null,
    created_at: session.createdAt || new Date().toISOString(),
  };
}

function readStoredSessions(key) {
  try {
    const sessions = JSON.parse(localStorage.getItem(key)) || [];
    return Array.isArray(sessions) ? sessions.map(normalizeSession).filter(isValidSession) : [];
  } catch {
    return [];
  }
}

function queueSession(session) {
  const pending = readStoredSessions(pendingKey);
  if (!pending.some((item) => item.id === session.id)) pending.push(session);
  localStorage.setItem(pendingKey, JSON.stringify(pending));
}

async function submitSession(session) {
  if (!supabaseClient || !navigator.onLine) {
    queueSession(session);
    return false;
  }
  const { error } = await supabaseClient.from("sessions").insert(toDatabaseSession(session));
  if (error && error.code !== "23505") {
    queueSession(session);
    return false;
  }
  return true;
}

async function syncPendingSessions() {
  const pending = readStoredSessions(pendingKey);
  if (!pending.length || !supabaseClient || !navigator.onLine) return;
  const remaining = [];
  for (const session of pending) {
    const { error } = await supabaseClient.from("sessions").insert(toDatabaseSession(session));
    if (error && error.code !== "23505") remaining.push(session);
  }
  if (remaining.length) localStorage.setItem(pendingKey, JSON.stringify(remaining));
  else localStorage.removeItem(pendingKey);
}

async function refreshAdminData() {
  document.querySelector("#sync-state").textContent = "Syncing…";
  const { data, error } = await supabaseClient.from("sessions").select("*").order("created_at", { ascending: false });
  if (error) {
    document.querySelector("#sync-state").textContent = "Setup required";
    throw error;
  }
  sessionsCache = data.map(normalizeSession).filter(isValidSession);
  document.querySelector("#sync-state").textContent = "Cloud synced";
  renderAllData();
}

async function migrateLegacySessions() {
  const legacy = readStoredSessions(storageKey);
  if (!legacy.length) return;
  const { error } = await supabaseClient.from("sessions").upsert(legacy.map(toDatabaseSession), { onConflict: "id" });
  if (!error) localStorage.removeItem(storageKey);
}

async function setAdminMode(enabled) {
  isAdmin = enabled;
  document.querySelectorAll(".admin-only").forEach((element) => element.classList.toggle("hidden", !enabled));
  document.querySelector("#admin-access").textContent = enabled ? "Admin" : "Admin login";
  window.DanzSite.setAdminAccess(enabled);
  if (!enabled) {
    sessionsCache = [];
    renderAllData();
    return;
  }
  try {
    await migrateLegacySessions();
    await refreshAdminData();
  } catch {
    showToast("Run the Supabase database setup to enable admin data.");
  }
}

async function handleAuthSession(session) {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return setAdminMode(false);
  if (email !== supabaseConfig.adminEmail.toLowerCase()) {
    await supabaseClient.auth.signOut();
    showToast("This account is not authorized.");
    return setAdminMode(false);
  }
  adminDialog.close();
  await setAdminMode(true);
}

async function initializeAuth() {
  if (!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  await handleAuthSession(data.session);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => handleAuthSession(session), 0);
  });
  await syncPendingSessions();
}

function distanceName(distance) {
  if (distance === 5) return "5K";
  if (distance === 10) return "10K";
  if (distance === 21.0975) return "Half marathon";
  return `${Number(distance.toFixed(2))}K`;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function resultSummary(session) {
  if (!session.actualSeconds) return `<span class="status-chip">Planned</span>`;
  const difference = session.actualSeconds - session.totalSeconds;
  const resultClass = difference <= 0 ? "ahead" : "behind";
  const resultText = difference === 0 ? "On target" : `${formatDuration(Math.abs(difference))} ${difference < 0 ? "ahead" : "behind"}`;
  return `<span class="status-chip completed">Completed</span><small class="result-delta ${resultClass}">${resultText}</small>`;
}

function renderSessions() {
  const sessions = getSessions();
  const completed = sessions.filter((session) => session.actualSeconds);
  document.querySelector("#session-count").textContent = sessions.length;
  document.querySelector("#completed-count").textContent = completed.length;
  const list = document.querySelector("#session-list");
  list.innerHTML = sessions.length ? sessions.map((session) => `
    <article class="session-item ${session.actualSeconds ? "is-complete" : ""}">
      <div class="session-identity"><div>${resultSummary(session)}</div><h3>${escapeHtml(session.runner)}</h3><p>${formatDate(session.date)}</p></div>
      <div><span>Distance</span><strong>${distanceName(session.distance)}</strong></div>
      <div><span>Target</span><strong>${formatDuration(session.totalSeconds)}</strong><small>${formatDuration(session.paceSeconds)} /km</small></div>
      <div><span>${session.actualSeconds ? "Actual" : "Status"}</span><strong>${session.actualSeconds ? formatDuration(session.actualSeconds) : "Ready"}</strong>${session.actualSeconds ? `<small>${formatDuration(session.actualSeconds / session.distance)} /km</small>` : ""}</div>
      <div class="session-actions">
        ${session.actualSeconds ? "" : `<button type="button" data-complete="${session.id}">Add result</button>`}
        <button type="button" data-edit="${session.id}">Edit</button>
        <button type="button" data-duplicate="${session.id}">Duplicate</button>
        <button type="button" data-share="${session.id}">Share</button>
        <button class="danger" type="button" data-delete="${session.id}">Delete</button>
      </div>
    </article>`).join("") : `<div class="empty-state">No sessions yet. Build your first pace plan.</div>`;

  list.querySelectorAll("[data-edit], [data-complete]").forEach((button) => button.addEventListener("click", () => {
    openSessionEditor(button.dataset.edit || button.dataset.complete, Boolean(button.dataset.complete));
  }));
  list.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", () => duplicateSession(button.dataset.duplicate)));
  list.querySelectorAll("[data-share]").forEach((button) => button.addEventListener("click", () => shareSession(getSessions().find((session) => session.id === button.dataset.share))));
  list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!globalThis.confirm("Delete this session?")) return;
    const { error } = await supabaseClient.from("sessions").delete().eq("id", button.dataset.delete);
    if (error) return showToast("Could not delete this session.");
    await refreshAdminData();
    showToast("Session deleted.");
  }));
}

function renderInsights() {
  const sessions = getSessions();
  const completed = sessions.filter((session) => session.actualSeconds);
  document.querySelector("#total-sessions").textContent = sessions.length;
  document.querySelector("#runs-completed").textContent = completed.length;
  document.querySelector("#average-pace").textContent = sessions.length
    ? formatDuration(sessions.reduce((sum, session) => sum + session.paceSeconds, 0) / sessions.length)
    : "—";
  document.querySelector("#personal-best").textContent = completed.length
    ? formatDuration(Math.min(...completed.map((session) => session.actualSeconds / session.distance)))
    : "—";

  const paceHistory = document.querySelector("#pace-history");
  if (!completed.length) {
    paceHistory.innerHTML = `<p class="empty-state compact">Complete a run to start your pace history.</p>`;
  } else {
    const recent = [...completed].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
    const slowestPace = Math.max(...recent.map((session) => session.actualSeconds / session.distance));
    paceHistory.innerHTML = recent.map((session) => {
      const pace = session.actualSeconds / session.distance;
      return `<div class="history-row"><span>${new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span><div class="bar-track"><div class="bar-fill pace" style="width:${Math.max(14, pace / slowestPace * 100)}%"></div></div><strong>${formatDuration(pace)}</strong></div>`;
    }).join("");
  }

  const counts = sessions.reduce((result, session) => {
    const label = distanceName(session.distance);
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  document.querySelector("#distance-bars").innerHTML = entries.length ? entries.map(([label, count]) => `
    <div class="bar-label"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${count / entries[0][1] * 100}%"></div></div><strong>${count}</strong></div>`).join("")
    : `<p class="empty-state compact">Session distances will appear here.</p>`;
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function renderAllData() {
  renderSessions();
  renderInsights();
}

function showAdminView(viewName) {
  if (viewName !== "plan" && !isAdmin) return;
  window.DanzSite.showPage(viewName);
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminView === viewName);
  });
}

function openSessionEditor(id, completing = false) {
  const session = getSessions().find((item) => item.id === id);
  if (!session) return;
  document.querySelector("#dialog-session-id").value = session.id;
  document.querySelector("#dialog-runner").value = session.runner;
  document.querySelector("#dialog-date").value = session.date;
  document.querySelector("#dialog-distance").value = session.distance;
  document.querySelector("#dialog-target").value = formatDuration(session.totalSeconds);
  document.querySelector("#dialog-actual").value = session.actualSeconds ? formatDuration(session.actualSeconds) : "";
  document.querySelector("#dialog-title").textContent = completing ? "How did the run go?" : "Update your run";
  document.querySelector("#dialog-message").textContent = "";
  sessionDialog.showModal();
  (completing ? document.querySelector("#dialog-actual") : document.querySelector("#dialog-runner")).focus();
}

async function duplicateSession(id) {
  const session = getSessions().find((item) => item.id === id);
  if (!session) return;
  const copy = { ...session, id: makeId(), actualSeconds: null, status: "planned", createdAt: new Date().toISOString() };
  const { error } = await supabaseClient.from("sessions").insert(toDatabaseSession(copy));
  if (error) return showToast("Could not duplicate this session.");
  await refreshAdminData();
  showToast("Session duplicated.");
}

function planUrl(session) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("distance", session.distance);
  url.searchParams.set("time", Math.round(session.totalSeconds));
  url.searchParams.set("runner", session.runner);
  url.searchParams.set("date", session.date);
  return url.toString();
}

async function shareSession(session) {
  if (!session) return;
  const url = planUrl(session);
  const data = { title: "Danz Run Lab pace plan", text: `${session.runner}'s ${distanceName(session.distance)} target: ${formatDuration(session.totalSeconds)}`, url };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied.");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("Could not share this plan.");
  }
}

function loadSharedPlan() {
  const params = new URLSearchParams(location.search);
  if (!params.has("distance") || !params.has("time")) return;
  const distance = Number(params.get("distance"));
  const totalSeconds = Number(params.get("time"));
  if (!Number.isFinite(distance) || distance < 0.4 || distance > 100 || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return;
  const preset = distanceInputs.find((input) => Number(input.value) === distance);
  (preset || distanceInputs.find((input) => input.value === "custom")).checked = true;
  customWrap.classList.toggle("hidden", Boolean(preset));
  customDistance.value = distance;
  timeInputs[0].value = Math.floor(totalSeconds / 3600);
  timeInputs[1].value = Math.floor(totalSeconds % 3600 / 60);
  timeInputs[2].value = Math.round(totalSeconds % 60);
  runnerName.value = (params.get("runner") || "").slice(0, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "")) sessionDate.value = params.get("date");
  renderPlan();
  document.querySelector("#form-message").textContent = "Shared plan loaded. Submit it to add it to the run list.";
}

function downloadFile(name, contents, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value) {
  let safeValue = String(value ?? "");
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const sessions = getSessions();
  if (!sessions.length) return showToast("Add a session before exporting.");
  const rows = [["Runner", "Date", "Distance (km)", "Target time", "Target pace /km", "Actual time", "Actual pace /km", "Status"]];
  sessions.forEach((session) => rows.push([
    session.runner, session.date, session.distance, formatDuration(session.totalSeconds), formatDuration(session.paceSeconds),
    session.actualSeconds ? formatDuration(session.actualSeconds) : "", session.actualSeconds ? formatDuration(session.actualSeconds / session.distance) : "", session.status,
  ]));
  downloadFile(`danz-run-lab-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

distanceInputs.forEach((input) => input.addEventListener("change", () => {
  customWrap.classList.toggle("hidden", input.value !== "custom" || !input.checked);
  renderPlan();
}));
[...timeInputs, customDistance].forEach((input) => input.addEventListener("input", renderPlan));

document.querySelector("#save-session").addEventListener("click", async () => {
  const plan = calculatePlan();
  const message = document.querySelector("#form-message");
  if (!plan || !form.checkValidity() || !runnerName.value.trim()) {
    message.textContent = "Add your name, date and a valid target time.";
    return;
  }
  const session = normalizeSession({
    id: makeId(),
    runner: runnerName.value.trim(),
    date: sessionDate.value,
    distance: plan.distance,
    totalSeconds: plan.totalSeconds,
    paceSeconds: plan.paceSeconds,
    actualSeconds: null,
    status: "planned",
    createdAt: new Date().toISOString(),
  });
  message.textContent = "Submitting your session…";
  const synced = await submitSession(session);
  message.textContent = synced
    ? "Pace submitted. The Danz team can now see your session."
    : "Saved on this device. It will submit automatically when the connection is ready.";
  if (isAdmin && synced) await refreshAdminData();
});

document.querySelector("#share-plan").addEventListener("click", () => {
  const plan = calculatePlan();
  if (!plan) return;
  shareSession({ ...plan, runner: runnerName.value.trim() || "Runner", date: sessionDate.value });
});

document.querySelector("#admin-access").addEventListener("click", async () => {
  if (isAdmin) {
    window.DanzSite.navigate("/admin");
    return;
  }
  document.querySelector("#admin-message").textContent = "";
  adminDialog.showModal();
});
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => showAdminView(button.dataset.adminView));
});
document.querySelectorAll("[data-admin-signout]").forEach((button) => {
  button.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showToast("Signed out.");
  });
});
document.querySelector("#close-admin-dialog").addEventListener("click", () => adminDialog.close());
adminDialog.addEventListener("click", (event) => {
  if (event.target === adminDialog) adminDialog.close();
});
document.querySelector("#admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#admin-message");
  const email = document.querySelector("#admin-email").value.trim().toLowerCase();
  if (email !== supabaseConfig.adminEmail.toLowerCase()) {
    message.textContent = "This email is not authorized for admin access.";
    return;
  }
  if (!supabaseClient) {
    message.textContent = "Admin sign-in is temporarily unavailable.";
    return;
  }
  message.textContent = "Sending a secure sign-in link…";
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}${location.pathname}` },
  });
  message.textContent = error ? error.message : "Check your email and open the sign-in link.";
});
document.querySelector("#close-dialog").addEventListener("click", () => sessionDialog.close());
sessionDialog.addEventListener("click", (event) => {
  if (event.target === sessionDialog) sessionDialog.close();
});

sessionEditor.addEventListener("submit", async (event) => {
  event.preventDefault();
  const targetSeconds = parseDuration(document.querySelector("#dialog-target").value);
  const actualValue = document.querySelector("#dialog-actual").value.trim();
  const actualSeconds = actualValue ? parseDuration(actualValue) : null;
  const distance = Number(document.querySelector("#dialog-distance").value);
  const message = document.querySelector("#dialog-message");
  if (!sessionEditor.checkValidity() || !targetSeconds || actualValue && !actualSeconds || distance < 0.4 || distance > 100) {
    message.textContent = "Use a valid distance and time such as 25:00 or 1:45:00.";
    return;
  }
  const id = document.querySelector("#dialog-session-id").value;
  const currentSession = getSessions().find((session) => session.id === id);
  if (!currentSession) return;
  const updatedSession = normalizeSession({
    ...currentSession,
    runner: document.querySelector("#dialog-runner").value.trim(),
    date: document.querySelector("#dialog-date").value,
    distance,
    totalSeconds: targetSeconds,
    actualSeconds,
  });
  const { error } = await supabaseClient.from("sessions").update(toDatabaseSession(updatedSession)).eq("id", id);
  if (error) {
    message.textContent = "Could not update this session.";
    return;
  }
  sessionDialog.close();
  await refreshAdminData();
  showToast(actualSeconds ? "Result saved." : "Session updated.");
});

document.querySelector("#export-csv").addEventListener("click", exportCsv);
document.querySelector("#backup-data").addEventListener("click", () => {
  downloadFile(`danz-run-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getSessions(), null, 2), "application/json");
});
document.querySelector("#restore-data").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Backup must contain an array.");
    const sessions = data.map(normalizeSession);
    if (sessions.length !== data.length || !sessions.every(isValidSession)) throw new Error("Backup contains invalid sessions.");
    const { error } = await supabaseClient.from("sessions").upsert(sessions.map(toDatabaseSession), { onConflict: "id" });
    if (error) throw error;
    await refreshAdminData();
    showToast(`${sessions.length} sessions restored.`);
  } catch {
    showToast("That backup file is not valid.");
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#install-app").classList.remove("hidden");
});
document.querySelector("#install-app").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  document.querySelector("#install-app").classList.add("hidden");
});
window.addEventListener("appinstalled", () => showToast("Danz Run Lab installed."));
window.addEventListener("online", async () => {
  await syncPendingSessions();
  if (isAdmin) await refreshAdminData();
});

form.addEventListener("submit", (event) => event.preventDefault());
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
loadSharedPlan();
renderPlan();
renderAllData();
initializeAuth();
