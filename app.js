const storageKey = "danz-run-lab-sessions";
const form = document.querySelector("#pace-form");
const distanceInputs = [...document.querySelectorAll('[name="distance"]')];
const timeInputs = ["hours", "minutes", "seconds"].map((id) => document.querySelector(`#${id}`));
const customWrap = document.querySelector("#custom-distance-wrap");
const customDistance = document.querySelector("#custom-distance");
const sessionDate = document.querySelector("#session-date");
const runnerName = document.querySelector("#runner-name");

sessionDate.value = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

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

function getSessions() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
  catch { return []; }
}

function saveSessions(sessions) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

function distanceName(distance) {
  if (distance === 5) return "5K";
  if (distance === 10) return "10K";
  if (distance === 21.0975) return "Half marathon";
  return `${distance.toFixed(1)}K`;
}

function renderSessions() {
  const sessions = getSessions();
  document.querySelector("#session-count").textContent = sessions.length;
  const list = document.querySelector("#session-list");
  list.innerHTML = sessions.length ? sessions.map((session) => `
    <article class="session-item">
      <div><h3>${escapeHtml(session.runner)}</h3><p>${new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p></div>
      <div><span>Distance</span><strong>${distanceName(session.distance)}</strong></div>
      <div><span>Target pace</span><strong>${formatDuration(session.paceSeconds)} /km</strong></div>
      <div><span>Finish</span><strong>${formatDuration(session.totalSeconds)}</strong></div>
      <button type="button" data-delete="${session.id}" aria-label="Delete ${escapeHtml(session.runner)}'s session">×</button>
    </article>`).join("") : `<div class="empty-state">No sessions yet. Build your first pace plan.</div>`;

  list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    saveSessions(getSessions().filter((session) => session.id !== button.dataset.delete));
    renderAllData();
  }));
}

function renderInsights() {
  const sessions = getSessions();
  document.querySelector("#total-sessions").textContent = sessions.length;
  if (!sessions.length) {
    document.querySelector("#popular-distance").textContent = "—";
    document.querySelector("#average-pace").textContent = "—";
    document.querySelector("#distance-bars").innerHTML = `<p class="empty-state">Session demand will appear here.</p>`;
    return;
  }

  const counts = sessions.reduce((result, session) => {
    const label = distanceName(session.distance);
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  document.querySelector("#popular-distance").textContent = entries[0][0];
  document.querySelector("#average-pace").textContent = formatDuration(sessions.reduce((sum, session) => sum + session.paceSeconds, 0) / sessions.length);
  const maxCount = entries[0][1];
  document.querySelector("#distance-bars").innerHTML = entries.map(([label, count]) => `
    <div class="bar-label"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${count / maxCount * 100}%"></div></div><strong>${count}</strong></div>`).join("");
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

distanceInputs.forEach((input) => input.addEventListener("change", () => {
  customWrap.classList.toggle("hidden", input.value !== "custom" || !input.checked);
  renderPlan();
}));
[...timeInputs, customDistance].forEach((input) => input.addEventListener("input", renderPlan));

document.querySelector("#save-session").addEventListener("click", () => {
  const plan = calculatePlan();
  const message = document.querySelector("#form-message");
  if (!plan || !form.checkValidity() || !runnerName.value.trim()) {
    message.textContent = "Add your name, date and a valid target time.";
    return;
  }
  const sessions = getSessions();
  sessions.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    runner: runnerName.value.trim(),
    date: sessionDate.value,
    distance: plan.distance,
    totalSeconds: plan.totalSeconds,
    paceSeconds: plan.paceSeconds,
  });
  saveSessions(sessions);
  message.textContent = "Pace booked. Your session is on the run list.";
  renderAllData();
});

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab, .view").forEach((element) => element.classList.remove("active"));
  tab.classList.add("active");
  document.querySelector(`#${tab.dataset.view}`).classList.add("active");
}));

form.addEventListener("submit", (event) => event.preventDefault());
renderPlan();
renderAllData();
