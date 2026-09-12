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

const STORAGE_KEY = "inspection-assist-state-v5";
let state = loadState();
let activeContainerId = null;
let currentFilter = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const el = {
  containerForm: $("#containerForm"), containerInput: $("#containerInput"), containerResult: $("#containerResult"),
  productForm: $("#productForm"), barcodeInput: $("#barcodeInput"), productSubmit: $("#productSubmit"), productHint: $("#productHint"), scanResult: $("#scanResult"),
  selectedContainerLabel: $("#selectedContainerLabel"), containerDetails: $("#containerDetails"), table: $("#itemTableBody"), tableWrap: $("#itemTableWrap"), emptySelection: $("#emptySelection"),
  customerProgress: $("#customerProgress"), containerCount: $("#containerCount"), expectedQty: $("#expectedQty"), checkedQty: $("#checkedQty"), differenceQty: $("#differenceQty"),
  progressPercent: $("#progressPercent"), progressBar: $("#progressBar"), progressCaption: $("#progressCaption"), completeButton: $("#completeButton"), completeHelp: $("#completeHelp"),
  activity: $("#activityList"), resetButton: $("#resetButton"), toast: $("#toast")
};

function cloneSource() { return structuredClone(SOURCE_CONTAINERS); }
function loadState() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved?.containers?.length === SOURCE_CONTAINERS.length) return saved; } catch (_) {}
  return { containers: cloneSource(), activity: [], unknownCount: 0 };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function activeContainer() { return state.containers.find((container) => container.id === activeContainerId); }
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
  const totals = allMetrics();
  el.containerCount.textContent = state.containers.length;
  el.expectedQty.textContent = totals.expected;
  el.checkedQty.textContent = totals.actual;
  el.differenceQty.textContent = totals.differences;
  renderCustomers(); renderActiveContainer(); renderActivity();
}

function renderCustomers() {
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
    el.completeButton.disabled = true; return;
  }
  const m = containerMetrics(container);
  const allMatched = container.items.every((item) => item.actual === item.expected);
  el.selectedContainerLabel.textContent = `オリコン ${container.id}`;
  el.productHint.textContent = `対象商品 ${container.items.length}品番・予定 ${m.expected}点。対象外の商品は品違いとして記録されます。`;
  el.barcodeInput.placeholder = "商品バーコードをスキャンまたは入力";
  el.containerDetails.className = "container-detail-content";
  el.containerDetails.innerHTML = `<div class="container-number"><span>オリコン</span><strong>${container.id}</strong></div><dl><div><dt>得意先</dt><dd>${container.customer}</dd></div><div><dt>配送便</dt><dd>${container.route}</dd></div><div><dt>検証パターン</dt><dd>${container.pattern}</dd></div><div><dt>対象明細</dt><dd>${container.items.length}品番 / ${m.expected}点</dd></div></dl>`;
  el.progressPercent.textContent = `${m.percent}%`; el.progressBar.style.width = `${m.percent}%`; el.progressCaption.textContent = `${m.credited} / ${m.expected} 点を検品済み`;
  el.completeButton.disabled = !allMatched || container.completed;
  el.completeButton.innerHTML = container.completed ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>完了済み' : '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>このオリコンを完了する';
  el.completeHelp.textContent = container.completed ? "検品結果を保存しました" : allMatched ? "予定数との一致を確認しました" : "全商品が適正になると完了できます";
  renderTable(container);
}

function renderTable(container) {
  const items = container.items.filter((item) => { const status = statusFor(item).key; return currentFilter === "pending" ? status !== "done" : currentFilter === "done" ? status === "done" : true; });
  el.table.innerHTML = items.map((item) => { const status = statusFor(item); return `<tr><td class="product-cell"><span class="product-name">${item.name}</span><span class="product-code">${item.id}</span></td><td><span class="barcode-text">${item.barcode}</span></td><td class="count-cell">${item.expected}</td><td class="count-cell"><strong>${item.actual}</strong></td><td><span class="status-badge ${status.key}">${status.label}</span></td><td><div class="adjust-controls"><button class="adjust-button" data-action="minus" data-id="${item.id}" aria-label="${item.name}を1点減らす">−</button><button class="adjust-button" data-action="plus" data-id="${item.id}" aria-label="${item.name}を1点増やす">＋</button></div></td></tr>`; }).join("") || '<tr><td colspan="6" class="no-rows">該当する商品はありません</td></tr>';
}

function selectContainer(id) {
  const container = state.containers.find((candidate) => candidate.id === id.trim());
  if (!container) { showResult(el.containerResult, "error", "登録されていないオリコンです", id.trim()); addActivity("error", "オリコン不明", id.trim()); saveState(); render(); return; }
  activeContainerId = container.id;
  showResult(el.containerResult, "ok", `${container.customer} の対象データを表示しました`, `${container.items.length}品番 / ${containerMetrics(container).expected}点`);
  el.scanResult.innerHTML = ""; render();
  if (!container.completed) el.barcodeInput.focus();
}

function scanProduct(rawBarcode) {
  const container = activeContainer(); const barcode = rawBarcode.trim();
  if (!container || !barcode) return;
  const item = container.items.find((candidate) => candidate.barcode === barcode);
  if (!item) { state.unknownCount = (state.unknownCount || 0) + 1; addActivity("error", "品違いを検知", `${barcode} / ORI ${container.id}`); showResult(el.scanResult, "error", "このオリコンの対象外商品です", barcode); saveState(); render(); return; }
  item.actual += 1;
  const over = item.actual > item.expected;
  addActivity(over ? "error" : "ok", item.name, `${item.actual} / ${item.expected}点・ORI ${container.id}`);
  showResult(el.scanResult, over ? "error" : "ok", over ? "予定数を超過しています" : `${item.name} を登録しました`, `${item.actual} / ${item.expected}点`);
  saveState(); render();
}

function addActivity(type, name, detail) { state.activity.unshift({ type, name, detail, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) }); state.activity = state.activity.slice(0, 30); }
function renderActivity() {
  if (!state.activity.length) { el.activity.innerHTML = '<li class="empty-activity">まだ読み取り履歴がありません</li>'; return; }
  el.activity.innerHTML = state.activity.slice(0, 6).map((entry) => `<li class="activity-item"><span class="activity-icon ${entry.type}"><svg viewBox="0 0 24 24">${entry.type === "error" ? '<path d="M12 8v5m0 3v.1M4.5 19h15L12 5 4.5 19Z"/>' : '<path d="m5 12 4 4L19 6"/>'}</svg></span><span><strong>${entry.name}</strong><small>${entry.detail}</small></span><time class="activity-time">${entry.time}</time></li>`).join("");
}
function showResult(target, type, message, detail = "") { target.innerHTML = `<div class="result-message ${type}"><span>${message}</span><small>${detail}</small></div>`; }
function showToast(message) { clearTimeout(toastTimer); el.toast.textContent = message; el.toast.classList.add("show"); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600); }

el.containerForm.addEventListener("submit", (event) => { event.preventDefault(); if (!el.containerInput.value.trim()) return showResult(el.containerResult, "warn", "オリコンナンバーを入力してください"); selectContainer(el.containerInput.value); el.containerInput.value = ""; });
el.productForm.addEventListener("submit", (event) => { event.preventDefault(); scanProduct(el.barcodeInput.value); el.barcodeInput.value = ""; el.barcodeInput.focus(); });
el.table.addEventListener("click", (event) => { const button = event.target.closest(".adjust-button"); const container = activeContainer(); if (!button || !container || container.completed) return; const item = container.items.find((candidate) => candidate.id === button.dataset.id); item.actual = Math.max(0, item.actual + (button.dataset.action === "plus" ? 1 : -1)); addActivity("ok", item.name, `手動修正 ${item.actual} / ${item.expected}点`); saveState(); render(); });
document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active")); button.classList.add("active"); currentFilter = button.dataset.filter; if (activeContainer()) renderTable(activeContainer()); }));
el.completeButton.addEventListener("click", () => { const container = activeContainer(); if (!container) return; container.completed = true; addActivity("ok", `オリコン ${container.id}`, "検品完了"); saveState(); render(); showToast(`オリコン ${container.id} の検品を完了しました`); el.containerInput.focus(); });
el.resetButton.addEventListener("click", () => { if (!window.confirm("すべての検品データと履歴をリセットしますか？")) return; state = { containers: cloneSource(), activity: [], unknownCount: 0 }; activeContainerId = null; saveState(); el.containerResult.innerHTML = ""; el.scanResult.innerHTML = ""; render(); showToast("検品データをリセットしました"); });

$("#todayLabel").textContent = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());
render();
