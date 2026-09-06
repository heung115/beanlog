"use strict";

const byId = (id) => document.getElementById(id);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const text = (id, value) => { byId(id).textContent = value; };
const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const stamp = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const clock = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
let latestSnapshot = null;
let fetching = false;
let lastFetchFailed = false;

function bytes(value) {
  if (!isNumber(value)) return "확인 불가";
  if (value < 1024) return `${number.format(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${number.format(amount)} ${units[unit]}`;
}

function duration(value) {
  if (!isNumber(value)) return "확인 불가";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  if (days) return `${days}일 ${hours}시간`;
  if (hours) return `${hours}시간 ${Math.floor((value % 3600) / 60)}분`;
  return `${Math.floor(value / 60)}분`;
}

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function metric(name, value, detail) {
  const known = isNumber(value) && value <= 100;
  const target = byId(`${name}-value`);
  target.replaceChildren(document.createTextNode(known ? number.format(value) : "—"));
  if (known) target.append(node("span", "%", "unit"));
  text(`${name}-detail`, detail);
  const meter = byId(`${name}-meter`);
  meter.style.width = known ? `${value}%` : "0%";
  meter.dataset.level = !known ? "unknown" : value >= 90 ? "error" : value >= 75 ? "warning" : "healthy";
}

function stateInfo(service) {
  if (service.status === "running") {
    if (service.health === "unhealthy") return ["상태 점검 실패", "error"];
    if (service.health === "starting") return ["준비 중", "warning"];
    return [service.health === "healthy" ? "정상" : "실행 중", "healthy"];
  }
  if (service.status === "restarting") return ["재시작 중", "warning"];
  if (service.status === "paused") return ["일시 정지", "warning"];
  if (["exited", "dead"].includes(service.status)) return ["중지됨", "error"];
  if (["created", "removing"].includes(service.status)) return ["준비 중", "warning"];
  return ["확인 불가", "unknown"];
}

function renderServices(snapshot) {
  const rows = snapshot.containers.map((service) => {
    const [label, level] = stateInfo(service);
    const row = node("tr");
    row.append(node("td", service.label, "service-label"));
    const cell = node("td");
    const state = node("span", label, "state");
    state.dataset.level = level;
    cell.append(state);
    row.append(cell, node("td", isNumber(service.restartCount) ? `${service.restartCount}회` : "—", "right"));
    return row;
  });
  byId("services").replaceChildren(...rows);
  const healthy = snapshot.containers.filter((item) => stateInfo(item)[1] === "healthy").length;
  text("service-count", `${healthy} / ${snapshot.containers.length}개 실행 중`);
  byId("health-checks").replaceChildren(...snapshot.checks.map((check) => {
    const label = check.status === "healthy" ? "정상" : check.status === "unhealthy" ? "응답 오류" : "확인 불가";
    const element = node("div", undefined, "health-check");
    element.dataset.state = ["healthy", "unhealthy", "unavailable"].includes(check.status) ? check.status : "unavailable";
    element.append(node("span", check.label), node("strong", label));
    return element;
  }));
}

const connectionLabels = {
  active: "작업 중", idle: "대기", "idle in transaction": "트랜잭션 대기",
  "idle in transaction (aborted)": "실패한 트랜잭션 대기", "fastpath function call": "함수 실행",
  disabled: "추적 중지", unknown: "기타",
};

function renderDatabase(database, backup) {
  const available = database?.status === "available";
  text("database-state", available ? "연결됨" : "확인 불가");
  text("db-size", available ? bytes(database.sizeBytes) : "—");
  text("db-connections", available && isNumber(database.totalConnections) ? `${number.format(database.totalConnections)}개` : "—");
  const states = available && Array.isArray(database.connections) ? database.connections : [];
  const active = available ? states.find((state) => state.state === "active")?.count ?? 0 : null;
  text("db-active", isNumber(active) ? `${number.format(active)}개` : "—");
  byId("connection-states").replaceChildren(...states.filter((state) => state.state !== "active" && isNumber(state.count)).map((state) => node("span", `${connectionLabels[state.state] || "기타"} ${number.format(state.count)}`)));
  const backupDate = new Date(backup?.lastModified);
  if (backup?.status === "available" && backup?.lastModified && Number.isFinite(backupDate.getTime())) {
    text("backup-time", stamp.format(backupDate));
    text("backup-detail", `${duration(backup.ageSeconds)} 전 · ${bytes(backup.sizeBytes)}`);
  } else {
    text("backup-time", backup?.status === "empty" ? "저장된 파일 없음" : "확인 불가");
    text("backup-detail", "최근 파일의 시각과 크기를 표시합니다.");
  }
}

function renderLogs(logs) {
  const services = Array.isArray(logs?.services) ? logs.services : [];
  byId("log-summary").replaceChildren(...services.map((service) => {
    const result = node("div", undefined, "log-summary-item");
    const available = service.status === "available" && isNumber(service.errors) && isNumber(service.warnings);
    const label = !available ? "확인 불가" : service.errors || service.warnings ? `오류 ${service.errors} · 경고 ${service.warnings}` : "오류·경고 없음";
    result.dataset.level = !available ? "unknown" : service.errors ? "error" : service.warnings ? "warning" : "healthy";
    result.append(node("span", service.service), node("strong", label));
    return result;
  }));
  const requests = services.flatMap((service) => Array.isArray(service.requests) ? service.requests : [])
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))).slice(0, 20);
  const rows = requests.map((request) => {
    const row = node("tr");
    const at = new Date(request.timestamp);
    row.append(node("td", request.timestamp && Number.isFinite(at.getTime()) ? clock.format(at) : "—"), node("td", request.service));
    const route = node("td");
    route.append(node("span", request.method, "request-method"), node("span", request.route, "request-route"));
    const response = node("td", isNumber(request.status) ? request.status : "—", "right response-code");
    response.dataset.level = request.status >= 500 ? "error" : request.status >= 400 ? "warning" : "info";
    row.append(route, response, node("td", request.duration || "—", "right"));
    return row;
  });
  if (!rows.length) {
    const empty = node("tr");
    const cell = node("td", services.some((service) => service.status === "available") ? "표시할 요청 요약이 없습니다." : "로그 상태를 확인할 수 없습니다.", "empty-cell");
    cell.colSpan = 5;
    empty.append(cell);
    rows.push(empty);
  }
  byId("requests").replaceChildren(...rows);
}

function updateFreshness() {
  const banner = byId("snapshot-status");
  if (!latestSnapshot) {
    banner.dataset.state = lastFetchFailed ? "offline" : "loading";
    text("status-message", lastFetchFailed ? "서버 상태를 가져오지 못했습니다." : "서버 상태를 불러오고 있습니다.");
    text("last-updated", lastFetchFailed ? "Tailscale 연결 상태를 확인해 주세요. 자동으로 다시 확인합니다." : "15초마다 자동 갱신");
    document.body.dataset.stale = lastFetchFailed ? "true" : "false";
    return;
  }
  const at = new Date(latestSnapshot.generatedAt);
  const age = (Date.now() - at.getTime()) / 1000;
  const stale = age > 60 || age < -30 || lastFetchFailed;
  const problems = latestSnapshot.containers.some((item) => stateInfo(item)[1] !== "healthy") ||
    latestSnapshot.checks.some((check) => check.status !== "healthy") || latestSnapshot.database?.status !== "available" ||
    latestSnapshot.collection.errors.length > 0;
  banner.dataset.state = lastFetchFailed ? "offline" : stale ? "stale" : problems ? "warning" : "healthy";
  document.body.dataset.stale = stale ? "true" : "false";
  text("status-message", lastFetchFailed ? "연결이 끊겨 마지막 확인 결과를 표시합니다." : stale ? "새 상태가 도착하지 않아 마지막 확인 결과를 표시합니다." : problems ? "확인이 필요한 항목이 있습니다." : "서비스가 정상적으로 실행 중입니다.");
  text("last-updated", `마지막 확인 ${clock.format(at)} · ${stale ? "현재 상태와 다를 수 있습니다." : "15초마다 자동 갱신"}`);
}

function render(snapshot) {
  const host = snapshot.host;
  metric("cpu", host.cpuPercent, isNumber(host.cpuPercent) ? "직전 수집 이후 평균 사용률" : "다음 수집 후 표시됩니다.");
  metric("memory", host.memory?.percent, host.memory ? `${bytes(host.memory.usedBytes)} / ${bytes(host.memory.totalBytes)} 사용` : "확인 불가");
  metric("disk", host.disk?.percent, host.disk ? `${bytes(host.disk.usedBytes)} / ${bytes(host.disk.totalBytes)} 사용` : "확인 불가");
  text("uptime-value", isNumber(host.uptimeSeconds) ? duration(host.uptimeSeconds) : "—");
  text("uptime-detail", isNumber(host.uptimeSeconds) ? "마지막 서버 시작 이후" : "확인 불가");
  renderServices(snapshot);
  renderDatabase(snapshot.database, snapshot.backup);
  renderLogs(snapshot.logs);
  updateFreshness();
}

async function fetchJSON(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(path, { cache: "no-store", credentials: "same-origin", signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error("unavailable");
    const body = await response.text();
    if (body.length > 1048576) throw new Error("invalid_snapshot");
    return JSON.parse(body);
  } finally { clearTimeout(timer); }
}

function validSnapshot(snapshot) {
  return snapshot?.schemaVersion === 1 && typeof snapshot.generatedAt === "string" &&
    Number.isFinite(Date.parse(snapshot.generatedAt)) && snapshot.host &&
    Array.isArray(snapshot.containers) && snapshot.containers.length <= 16 &&
    snapshot.containers.every((item) => item && typeof item.label === "string" && typeof item.status === "string") &&
    Array.isArray(snapshot.checks) && snapshot.checks.every((item) => item && typeof item.label === "string") &&
    snapshot.database && snapshot.backup && snapshot.logs && Array.isArray(snapshot.collection?.errors);
}

async function refresh() {
  if (fetching) return;
  fetching = true;
  byId("refresh").disabled = true;
  text("refresh", "확인 중");
  try {
    const snapshot = await fetchJSON("./status.json");
    if (!validSnapshot(snapshot)) throw new Error("invalid_snapshot");
    latestSnapshot = snapshot;
    lastFetchFailed = false;
    render(snapshot);
  } catch {
    lastFetchFailed = true;
    updateFreshness();
  } finally {
    fetching = false;
    byId("refresh").disabled = false;
    text("refresh", "새로고침");
  }
}

function privateLink(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith(".ts.net")) return null;
    return url.href;
  } catch { return null; }
}

async function loadLinks() {
  let linked = 0;
  try {
    const config = await fetchJSON("./config.json");
    for (const [key, id] of [["studioUrl", "studio-link"], ["adminUrl", "admin-link"]]) {
      const url = privateLink(config?.[key]);
      if (url) { byId(id).href = url; byId(id).hidden = false; linked += 1; }
    }
  } catch { /* The status dashboard remains usable if links are unavailable. */ }
  byId("links-pending").hidden = linked > 0;
  text("links-pending", "관리 도구 연결 주소가 아직 설정되지 않았습니다.");
}

byId("refresh").addEventListener("click", refresh);
refresh();
loadLinks();
setInterval(refresh, 15000);
setInterval(updateFreshness, 5000);
