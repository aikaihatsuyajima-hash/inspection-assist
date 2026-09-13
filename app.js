const CONTAINER_DATA = [
  { id: "10563560", customer: "サンプル得意先A", route: "東京・午前便", pattern: "品番少・数量少", quantities: [1], barcodes: ["4310145658032"] },
  { id: "10565288", customer: "サンプル得意先A", route: "東京・午前便", pattern: "品番少・数量少", quantities: [1, 1], barcodes: ["4232349728413", "4107393407617"] },
  { id: "10564568", customer: "サンプル得意先A", route: "東京・午後便", pattern: "品番多・数量多", quantities: [2,3,2,4,2,3,2,4,3,2,3,2,4,2,3,2,3,2,4,3,2,3,2,4,2,3,2,4,3,2], barcodes: [
    "4962269408866","4969677645418","4543709696762","4442677124676","4494210171623","4963101710123","4096054493765","4086207079151","4808836243914","4831711272471","4224599612970","4871283106316","4946726520247","4923827719978","4424426020613","4179898936831","4888112871901","4820133651445","4323009852538","4200079867689","4052282376300","4256421290186","4404043668771","4932052045370","4678160094014","4934803625206","4634213858408","4484821907322","4585622964597","4438860205611"] },
  { id: "10564280", customer: "サンプル得意先B", route: "埼玉便", pattern: "品番多・数量多", quantities: [3,2,4,2,3,2,4,3,2,3,2,4,2,3,2,4,3,2,3,2,4,3,2,3,2,4,3], barcodes: [
    "4390988375846","4361465543683","4707280860701","4615106505647","4820455718758","4503262665537","4538238915828","4854987970599","4683966426976","4518243061055","4792244476159","4634087060563","4147504728040","4691871294375","4066609123010","4585106381407","4574084075163","4936541472012","4047008780608","4117374438202","4250531187275","4250089342270","4859694977510","4856268692503","4722013673533","4784035557307","4242569358147"] },
  { id: "10565365", customer: "サンプル得意先B", route: "千葉便", pattern: "品番多い", barcodes: [
    "4417827296923","4834826678688","4313447323141","4491219139326","4631058328165","4731125208113","4203843066899","4037760564073","4228365360348","4825145267608","4235393985122","4753536207028","4219288362274","4212556825426","4404694386802","4803692892177","4041370251643","4667590137286","4563652700491","4281162329727","4653715400502","4726970769971","4335142049386","4726150817454","4896304301440","4830186561639","4095378893350","4558377177680","4601051455090"] },
  { id: "10564462", customer: "サンプル得意先C", route: "神奈川便", pattern: "品番多い", barcodes: [
    "4348543972023","4640848814818","4226791715503","4929988377330","4763943102304","4466930003546","4869888655117","4591570191237","4396166445516","4364493456246","4309002301075","4838433162226","4334782367140","4328413390515","4045434372688","4981048726328","4273064478320","4434295941131","4465788878405","4280964120082","4625652399294","4664302891672","4935901174931","4426961522386","4615004179483","4485166855903","4054000381764"] },
  { id: "10564208", customer: "サンプル得意先C", route: "神奈川便", pattern: "数量多い", quantities: [8, 6], barcodes: ["4788070113566", "4513682162165"] },
  { id: "10565081", customer: "サンプル得意先C", route: "神奈川便", pattern: "数量多い", quantities: [10], barcodes: ["4273845449907"] }
];

const SOURCE_CONTAINERS = CONTAINER_DATA.map((container, containerIndex) => ({
  ...container,
  items: container.barcodes.map((barcode, itemIndex) => ({
    id: `TEST-${String(containerIndex + 1).padStart(2, "0")}-${String(itemIndex + 1).padStart(3, "0")}`,
    barcode,
    name: `検証商品 ${String(itemIndex + 1).padStart(3, "0")}`,
    expected: container.quantities?.[itemIndex] ?? 1,
    actual: 0
  })),
  completed: false
}));

// 旧版の検品済み状態を新しい検証データへ引き継がないよう、データ形式を更新する。
const STORAGE_KEY = "inspection-assist-state-v6";
let state = loadState();
let activeContainerId = null;
let lastScannedItemId = null;
let currentFilter = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const el = {
  workerForm: $("#workerForm"), workerInput: $("#workerInput"), workerResult: $("#workerResult"), workerNameHeader: $("#workerNameHeader"),
  containerForm: $("#containerForm"), containerInput: $("#containerInput"), containerResult: $("#containerResult"),
  productForm: $("#productForm"), barcodeInput: $("#barcodeInput"), productSubmit: $("#productSubmit"), productHint: $("#productHint"), scanResult: $("#scanResult"),
  selectedContainerLabel: $("#selectedContainerLabel"), containerDetails: $("#containerDetails"), table: $("#itemTableBody"), tableWrap: $("#itemTableWrap"), emptySelection: $("#emptySelection"),
  customerProgress: $("#customerProgressOverview"),
  historyDeleteForm: $("#historyDeleteForm"), historyDeleteInput: $("#historyDeleteInput"), historyDeleteResult: $("#historyDeleteResult"), historyDeleteModal: $("#historyDeleteModal"), historyDeleteModalText: $("#historyDeleteModalText"), historyDeleteCancel: $("#historyDeleteCancel"), historyDeleteConfirm: $("#historyDeleteConfirm"),
  overallProgressPercent: $("#overallProgressPercent"), overallProgressBar: $("#overallProgressBar"), overallProgressCaption: $("#overallProgressCaption"), overallContainerCount: $("#overallContainerCount"), overallCompletedCount: $("#overallCompletedCount"), overallDifferenceCount: $("#overallDifferenceCount"),
  progressPercent: $("#progressPercent"), progressBar: $("#progressBar"), progressCaption: $("#progressCaption"), completeButton: $("#completeButton"), resolveOverageButton: $("#resolveOverageButton"), completeHelp: $("#completeHelp"),
  activity: $("#activityList"), resetButton: $("#resetButton"), toast: $("#toast")
};

function cloneSource() { return structuredClone(SOURCE_CONTAINERS); }
function loadState() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved?.containers?.length === SOURCE_CONTAINERS.length) return { ...saved, workerName: saved.workerName || "", unknownCounts: saved.unknownCounts || {} }; } catch (_) {}
  return { containers: cloneSource(), activity: [], unknownCount: 0, unknownCounts: {}, workerName: "" };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function activeContainer() { return state.containers.find((container) => container.id === activeContainerId); }
function focusProductInput() {
  if (!el.barcodeInput.disabled) requestAnimationFrame(() => el.barcodeInput.focus());
}
function containerMetrics(container) {
  const expected = container.items.reduce((sum, item) => sum + item.expected, 0);
  const actual = container.items.reduce((sum, item) => sum + item.actual, 0);
  const credited = container.items.reduce((sum, item) => sum + Math.min(item.actual, item.expected), 0);
  const differences = container.items.filter((item) => item.actual > item.expected).length;
  return { expected, actual, credited, differences, percent: expected ? Math.round(credited / expected * 100) : 0 };
}
function allMetrics() {
  return state.containers.reduce((total, container) => { const m = containerMetrics(container); total.expected += m.expected; total.actual += m.actual; total.differences += m.differences; return total; }, { expected: 0, actual: 0, differences: state.unknownCount || 0 });
}
function statusFor(item) {
  if (!item.actual) return { key: "pending", label: "未検品" };
  if (item.actual < item.expected) return { key: "progress", label: "検品中" };
  if (item.actual === item.expected) return { key: "done", label: "適正" };
  return { key: "over", label: "過剰" };
}

function render() {
  renderCustomers(); renderActiveContainer(); renderActivity(); renderHistory();
  el.workerNameHeader.textContent = state.workerName || "未登録";
  el.workerInput.value = state.workerName || "";
  const registered = Boolean(state.workerName);
  el.containerInput.disabled = !registered;
  el.containerInput.placeholder = registered ? "オリコンラベルをスキャンまたは入力" : "先に作業者を登録してください";
  el.containerForm.querySelector("button").disabled = !registered;
}

function renderCustomers() {
  const totals = allMetrics();
  const credited = state.containers.reduce((sum, container) => sum + containerMetrics(container).credited, 0);
  const overallPercent = totals.expected ? Math.round(credited / totals.expected * 100) : 0;
  if (el.overallProgressPercent) el.overallProgressPercent.textContent = `${overallPercent}%`;
  if (el.overallProgressBar) el.overallProgressBar.style.width = `${overallPercent}%`;
  if (el.overallProgressCaption) el.overallProgressCaption.textContent = `${credited} / ${totals.expected}点を検品済み`;
  if (el.overallContainerCount) el.overallContainerCount.textContent = state.containers.length;
  if (el.overallCompletedCount) el.overallCompletedCount.textContent = state.containers.filter((container) => container.completed).length;
  if (el.overallDifferenceCount) el.overallDifferenceCount.textContent = totals.differences;
  const names = [...new Set(state.containers.map((container) => container.customer))];
  el.customerProgress.innerHTML = names.map((name) => {
    const containers = state.containers.filter((container) => container.customer === name);
    const expected = containers.reduce((sum, c) => sum + containerMetrics(c).expected, 0);
    const actual = containers.reduce((sum, c) => sum + containerMetrics(c).actual, 0);
    const credited = containers.reduce((sum, c) => sum + containerMetrics(c).credited, 0);
    const percent = Math.round(credited / expected * 100);
    const completed = containers.filter((c) => c.completed).length;
    return `<article class="customer-card"><div class="customer-card-head"><span class="customer-avatar">${name.slice(-1)}</span><div><strong>${name}</strong><small>${containers.length} オリコン</small></div><b>${percent}%</b></div><div class="mini-progress"><span style="width:${percent}%"></span></div><div class="customer-stats"><span>検品 <strong>${actual}</strong> / ${expected}点</span><span>完了 <strong>${completed}</strong> / ${containers.length}箱</span></div></article>`;
  }).join("");
}

function renderActiveContainer() {
  const container = activeContainer();
  const hasContainer = Boolean(container);
  el.barcodeInput.disabled = !hasContainer || container?.completed;
  el.productSubmit.disabled = !hasContainer || container?.completed;
  el.tableWrap.hidden = !hasContainer;
  el.emptySelection.hidden = hasContainer;
  if (!container) {
    el.selectedContainerLabel.textContent = "オリコン未選択";
    el.productHint.textContent = "対象オリコンを選択すると、商品の読み取りを開始できます。";
    el.containerDetails.className = "no-container";
    el.containerDetails.innerHTML = "<span>オリコン未選択</span><p>ラベルを読み取ると詳細を表示します。</p>";
    el.progressPercent.textContent = "--"; el.progressBar.style.width = "0"; el.progressCaption.textContent = "対象を選択してください";
    el.completeButton.disabled = true; el.resolveOverageButton.hidden = true; return;
  }
  const m = containerMetrics(container);
  const allMatched = container.items.every((item) => item.actual === item.expected);
  const hasOverage = container.items.some((item) => item.actual > item.expected);
  el.selectedContainerLabel.textContent = `オリコン ${container.id}`;
  el.productHint.textContent = `対象商品 ${container.items.length}品番・予定 ${m.expected}点。対象外の商品は品違いとして記録されます。`;
  el.barcodeInput.placeholder = "商品バーコードをスキャンまたは入力";
  el.containerDetails.className = "container-detail-content";
  el.containerDetails.innerHTML = `<div class="container-number"><span>オリコン</span><strong>${container.id}</strong></div><dl><div><dt>得意先</dt><dd>${container.customer}</dd></div><div><dt>配送便</dt><dd>${container.route}</dd></div><div><dt>検証パターン</dt><dd>${container.pattern}</dd></div><div><dt>対象明細</dt><dd>${container.items.length}品番 / ${m.expected}点</dd></div></dl>`;
  el.progressPercent.textContent = `${m.percent}%`; el.progressBar.style.width = `${m.percent}%`; el.progressCaption.textContent = `${m.credited} / ${m.expected} 点を検品済み`;
  el.completeButton.disabled = !allMatched || container.completed;
  el.resolveOverageButton.hidden = !hasOverage || container.completed;
  el.completeButton.innerHTML = container.completed ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>完了済み' : '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>このオリコンを完了する';
  el.completeHelp.textContent = container.completed ? "検品結果を保存しました" : allMatched ? "予定数との一致を確認しました" : "全商品が適正になると完了できます";
  renderTable(container);
}

function renderTable(container) {
  const items = container.items.filter((item) => { const status = statusFor(item).key; return currentFilter === "pending" ? status !== "done" : currentFilter === "done" ? status === "done" : true; });
  const fallbackItem = currentFilter === "done" ? null : container.items.find((item) => item.actual < item.expected) ?? container.items.find((item) => item.actual > item.expected);
  const currentItem = items.find((item) => item.id === lastScannedItemId) ?? fallbackItem;
  el.table.innerHTML = items.map((item) => { const status = statusFor(item); const isCurrent = item.id === currentItem?.id; return `<tr data-item-id="${item.id}" class="${isCurrent ? "current-item" : ""}"${isCurrent ? ' aria-current="true"' : ""}><td class="product-cell"><span class="product-name">${item.name}${isCurrent ? '<span class="current-item-label">現在の検品対象</span>' : ""}</span><span class="product-code">${item.id}</span></td><td><span class="barcode-text">${item.barcode}</span></td><td class="count-cell">${item.expected}</td><td class="count-cell"><strong>${item.actual}</strong></td><td><span class="status-badge ${status.key}">${status.label}</span></td></tr>`; }).join("") || '<tr><td colspan="5" class="no-rows">該当する商品はありません</td></tr>';
  if (currentItem && currentFilter !== "done") requestAnimationFrame(() => el.table.querySelector(`[data-item-id="${currentItem.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
}

function selectContainer(id) {
  const container = state.containers.find((candidate) => candidate.id === id.trim());
  if (!container) { showResult(el.containerResult, "error", "登録されていないオリコンです", id.trim()); addActivity("error", "オリコン不明", id.trim()); saveState(); render(); return; }
  activeContainerId = container.id;
  lastScannedItemId = null;
  showResult(el.containerResult, "ok", `${container.customer} の対象データを表示しました`, `${container.items.length}品番 / ${containerMetrics(container).expected}点`);
  el.scanResult.innerHTML = ""; render();
  if (!container.completed) focusProductInput();
}

function scanProduct(rawBarcode) {
  const container = activeContainer(); const barcode = rawBarcode.trim();
  if (!container || !barcode) return;
  const item = container.items.find((candidate) => candidate.barcode === barcode);
  if (!item) { state.unknownCount = (state.unknownCount || 0) + 1; state.unknownCounts = state.unknownCounts || {}; state.unknownCounts[container.id] = (state.unknownCounts[container.id] || 0) + 1; addActivity("error", "品違いを検知", `${barcode} / ORI ${container.id}`); showResult(el.scanResult, "error", "このオリコンの対象外商品です", barcode); saveState(); render(); return; }
  item.actual += 1;
  lastScannedItemId = item.id;
  const over = item.actual > item.expected;
  addActivity(over ? "error" : "ok", item.name, `${item.actual} / ${item.expected}点・ORI ${container.id}`);
  showResult(el.scanResult, over ? "error" : "ok", over ? "予定数を超過しています" : `${item.name} を登録しました`, `${item.actual} / ${item.expected}点`);
  saveState(); render();
}

function addActivity(type, name, detail) { state.activity.unshift({ type, name, detail, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) }); state.activity = state.activity.slice(0, 30); }
function renderActivity() {
  if (!state.activity.length) { el.activity.innerHTML = '<li class="empty-activity">まだ読み取り履歴がありません</li>'; return; }
  el.activity.innerHTML = state.activity.slice(0, 3).map((entry) => `<li class="activity-item"><span class="activity-icon ${entry.type}"><svg viewBox="0 0 24 24">${entry.type === "error" ? '<path d="M12 8v5m0 3v.1M4.5 19h15L12 5 4.5 19Z"/>' : '<path d="m5 12 4 4L19 6"/>'}</svg></span><span><strong>${entry.name}</strong><small>${entry.detail}</small></span><time class="activity-time">${entry.time}</time></li>`).join("");
}
function renderHistory() {
  const historyList = $("#historyList"); const historyCountLabel = $("#historyCountLabel");
  if (!historyList) return;
  if (historyCountLabel) historyCountLabel.textContent = `${state.activity.length}件`;
  if (!state.activity.length) { historyList.innerHTML = '<li class="empty-activity">まだ検品履歴がありません</li>'; return; }
  historyList.innerHTML = state.activity.map((entry) => `<li class="history-item"><span class="activity-icon ${entry.type}"><svg viewBox="0 0 24 24">${entry.type === "error" ? '<path d="M12 8v5m0 3v.1M4.5 19h15L12 5 4.5 19Z"/>' : '<path d="m5 12 4 4L19 6"/>'}</svg></span><span><strong>${entry.name}</strong><small>${entry.detail}</small></span><time class="activity-time">${entry.time}</time></li>`).join("");
}
function showResult(target, type, message, detail = "") { target.innerHTML = `<div class="result-message ${type}"><span>${message}</span><small>${detail}</small></div>`; }
function showToast(message) { clearTimeout(toastTimer); el.toast.textContent = message; el.toast.classList.add("show"); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600); }

el.workerForm.addEventListener("submit", (event) => { event.preventDefault(); const workerName = el.workerInput.value.trim(); if (!workerName) return showResult(el.workerResult, "warn", "作業者名を入力してください"); state.workerName = workerName; saveState(); showResult(el.workerResult, "ok", `${workerName}さんを登録しました`, "オリコンの読み取りを開始できます"); render(); el.containerInput.focus(); });
el.containerForm.addEventListener("submit", (event) => { event.preventDefault(); if (!state.workerName) return showResult(el.workerResult, "warn", "先に作業者を登録してください"); if (!el.containerInput.value.trim()) return showResult(el.containerResult, "warn", "オリコンナンバーを入力してください"); selectContainer(el.containerInput.value); el.containerInput.value = ""; focusProductInput(); });
el.productForm.addEventListener("submit", (event) => { event.preventDefault(); scanProduct(el.barcodeInput.value); el.barcodeInput.value = ""; el.barcodeInput.focus(); });
el.containerInput.addEventListener("input", () => {
  if (!state.workerName) return;
  const value = el.containerInput.value.trim();
  if (value.length === 8 && state.containers.some((container) => container.id === value)) {
    selectContainer(value);
    el.containerInput.value = "";
    focusProductInput();
  }
});
el.barcodeInput.addEventListener("input", () => {
  const value = el.barcodeInput.value.trim();
  if (/^\d{13}$/.test(value)) {
    scanProduct(value);
    el.barcodeInput.value = "";
    focusProductInput();
  }
});
el.barcodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && activeContainer() && !activeContainer().completed) {
    event.preventDefault();
    focusProductInput();
  }
});
document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active")); button.classList.add("active"); currentFilter = button.dataset.filter; if (activeContainer()) renderTable(activeContainer()); }));
el.completeButton.addEventListener("click", () => { const container = activeContainer(); if (!container) return; container.completed = true; addActivity("ok", `オリコン ${container.id}`, "検品完了"); saveState(); render(); showToast(`オリコン ${container.id} の検品を完了しました`); el.containerInput.focus(); });
el.resolveOverageButton.addEventListener("click", () => { const container = activeContainer(); if (!container || container.completed || !container.items.some((item) => item.actual > item.expected)) return; if (!window.confirm("過剰になっている商品を予定数まで戻しますか？")) return; const overageItems = container.items.filter((item) => item.actual > item.expected); overageItems.forEach((item) => { item.actual = item.expected; }); addActivity("ok", `オリコン ${container.id}`, `過剰分を解除（${overageItems.length}品番）`); saveState(); render(); showToast(`オリコン ${container.id} の過剰分を解除しました`); });
el.resetButton.addEventListener("click", () => { if (!window.confirm("すべての検品データと履歴をリセットしますか？")) return; state = { containers: cloneSource(), activity: [], unknownCount: 0, unknownCounts: {}, workerName: "" }; activeContainerId = null; lastScannedItemId = null; saveState(); el.containerResult.innerHTML = ""; el.scanResult.innerHTML = ""; el.workerResult.innerHTML = ""; render(); showToast("検品データをリセットしました"); });

function closeHistoryDeleteModal() { el.historyDeleteModal.hidden = true; }
function openHistoryDeleteModal(container) {
  el.historyDeleteModalText.textContent = `オリコン ${container.id} の検品実績・完了状態・読み取り履歴を削除します。この操作は元に戻せません。`;
  el.historyDeleteModal.hidden = false;
  el.historyDeleteConfirm.focus();
}
el.historyDeleteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = el.historyDeleteInput.value.trim();
  const container = state.containers.find((candidate) => candidate.id === id);
  if (!container) return showResult(el.historyDeleteResult, "error", "登録されていないオリコンです", id || "番号未入力");
  showResult(el.historyDeleteResult, "warn", `オリコン ${container.id} を削除対象にしました`, "確認画面で確定してください");
  openHistoryDeleteModal(container);
});
el.historyDeleteCancel.addEventListener("click", closeHistoryDeleteModal);
el.historyDeleteModal.addEventListener("click", (event) => { if (event.target === el.historyDeleteModal) closeHistoryDeleteModal(); });
el.historyDeleteConfirm.addEventListener("click", () => {
  const id = el.historyDeleteInput.value.trim();
  const container = state.containers.find((candidate) => candidate.id === id);
  if (!container) return closeHistoryDeleteModal();
  container.items.forEach((item) => { item.actual = 0; });
  container.completed = false;
  state.activity = state.activity.filter((entry) => !entry.detail.includes(`ORI ${container.id}`) && entry.name !== `オリコン ${container.id}`);
  const removedUnknowns = state.unknownCounts?.[container.id] || 0;
  state.unknownCount = Math.max(0, (state.unknownCount || 0) - removedUnknowns);
  if (state.unknownCounts) delete state.unknownCounts[container.id];
  if (activeContainerId === container.id) { lastScannedItemId = null; el.containerResult.innerHTML = ""; el.scanResult.innerHTML = ""; }
  saveState(); render(); closeHistoryDeleteModal(); el.historyDeleteInput.value = ""; showResult(el.historyDeleteResult, "ok", `オリコン ${container.id} の検品履歴を削除しました`, "検品前の状態に戻しました"); showToast(`オリコン ${container.id} の履歴を削除しました`);
});

$("#customersTodayLabel").textContent = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());

function showView(viewId, updateHash = false) {
  const requestedView = document.getElementById(viewId) ? viewId : "workView";
  document.querySelectorAll(".tab-view").forEach((view) => { view.hidden = view.id !== requestedView; });
  document.querySelectorAll(".topnav a[data-view]").forEach((link) => {
    const active = link.dataset.view === requestedView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  if (updateHash) history.pushState(null, "", requestedView === "customersView" ? "#customers" : requestedView === "historyDeleteView" ? "#history-delete" : requestedView === "historyView" ? "#history" : "#work");
}

document.querySelectorAll(".topnav a[data-view]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  showView(link.dataset.view, true);
}));
window.addEventListener("popstate", () => showView(location.hash === "#customers" ? "customersView" : location.hash === "#history-delete" ? "historyDeleteView" : location.hash === "#history" ? "historyView" : "workView"));
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !el.historyDeleteModal.hidden) closeHistoryDeleteModal(); });
const viewFromHash = location.hash === "#customers" ? "customersView" : location.hash === "#history-delete" ? "historyDeleteView" : location.hash === "#history" ? "historyView" : "workView";
showView(viewFromHash);
render();
