const categories = [
  { name: "Alimentation", color: "#79a783", tint: "#edf4ea", mark: "A" },
  { name: "Transport", color: "#7898b7", tint: "#edf2f7", mark: "T" },
  { name: "Logement", color: "#dc9c65", tint: "#fbf1e8", mark: "L" },
  { name: "Santé", color: "#cb7f79", tint: "#f9eeec", mark: "S" },
  { name: "Loisirs", color: "#a28bb0", tint: "#f2eef5", mark: "D" },
  { name: "Abonnements", color: "#6eaaa5", tint: "#eaf4f2", mark: "A" },
  { name: "Shopping", color: "#d28b9e", tint: "#f8edf1", mark: "S" },
  { name: "Autre", color: "#9ba294", tint: "#f0f2ed", mark: "·" },
];

const storageKey = "clair-expenses-v1";
const walletStorageKey = "clair-wallet-balance-v1";
const budgetStorageKey = "clair-monthly-budgets-v1";
const themeStorageKey = "clair-theme-v1";
const availableThemes = ["forest", "lagoon", "coral"];
const savedTheme = loadTheme();
document.documentElement.dataset.theme = savedTheme;
const today = new Date();
const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthInputValue = (date) => dateInputValue(date).slice(0, 7);
const categoryByName = new Map(categories.map((category) => [category.name, category]));
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
const shortMoney = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" });

let expenses = loadExpenses();
let walletBalance = loadWalletBalance();
let monthlyBudgets = loadMonthlyBudgets();
let activePeriod = "month";
let selectedDate = dateInputValue(today);
let toastTimer;

const periodInput = document.querySelector("#periodInput");
const expenseDialog = document.querySelector("#expenseDialog");
const expenseForm = document.querySelector("#expenseForm");
const walletDialog = document.querySelector("#walletDialog");
const walletForm = document.querySelector("#walletForm");
const budgetDialog = document.querySelector("#budgetDialog");
const budgetForm = document.querySelector("#budgetForm");

function loadTheme() {
  try {
    const theme = localStorage.getItem(themeStorageKey);
    return availableThemes.includes(theme) ? theme : "forest";
  } catch {
    return "forest";
  }
}

function loadMonthlyBudgets() {
  try {
    const saved = JSON.parse(localStorage.getItem(budgetStorageKey) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([month, amount]) => /^\d{4}-\d{2}$/.test(month) && Number.isFinite(Number(amount)) && Number(amount) > 0).map(([month, amount]) => [month, Number(amount)]));
  } catch {
    return {};
  }
}

function saveMonthlyBudgets() {
  try {
    localStorage.setItem(budgetStorageKey, JSON.stringify(monthlyBudgets));
    return true;
  } catch {
    showToast("Enregistrement du budget impossible.");
    return false;
  }
}

function loadWalletBalance() {
  try {
    const saved = Number(localStorage.getItem(walletStorageKey) || 0);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  } catch {
    return 0;
  }
}

function saveWalletBalance() {
  try {
    localStorage.setItem(walletStorageKey, String(walletBalance));
    return true;
  } catch {
    showToast("Enregistrement du portefeuille impossible.");
    return false;
  }
}

function loadExpenses() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && categoryByName.has(item.category));
  } catch {
    return [];
  }
}

function saveExpenses() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(expenses));
    return true;
  } catch {
    showToast("Enregistrement impossible sur cet appareil.");
    return false;
  }
}

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function currentPeriodValue() {
  if (activePeriod === "day") return selectedDate;
  if (activePeriod === "month") return selectedDate.slice(0, 7);
  return selectedDate.slice(0, 4);
}

function setSelectedDate(value, period = activePeriod) {
  if (period === "day" && /^\d{4}-\d{2}-\d{2}$/.test(value)) selectedDate = value;
  if (period === "month" && /^\d{4}-\d{2}$/.test(value)) selectedDate = `${value}-01`;
  if (period === "year" && /^\d{4}$/.test(value)) selectedDate = `${value}-01-01`;
}

function syncPeriodInput() {
  const inputTypes = { day: "date", month: "month", year: "number" };
  periodInput.type = inputTypes[activePeriod];
  periodInput.value = currentPeriodValue();
  if (activePeriod === "year") {
    periodInput.min = "2000";
    periodInput.max = "2100";
    periodInput.step = "1";
    periodInput.placeholder = "AAAA";
  } else {
    periodInput.removeAttribute("min");
    periodInput.removeAttribute("max");
    periodInput.removeAttribute("step");
    periodInput.removeAttribute("placeholder");
  }
}

function periodExpenses() {
  const value = currentPeriodValue();
  return expenses.filter((item) => activePeriod === "day" ? item.date === value : activePeriod === "month" ? item.date.startsWith(value) : item.date.startsWith(value));
}

function periodLabel() {
  const date = localDate(selectedDate);
  if (activePeriod === "day") return longDate.format(date);
  if (activePeriod === "year") return selectedDate.slice(0, 4);
  return `${monthName.format(date)} ${date.getFullYear()}`;
}

function elapsedDays() {
  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7));
  if (activePeriod === "day") return 1;
  if (activePeriod === "month") {
    const selectedMonth = new Date(year, month - 1, 1);
    if (selectedMonth > new Date(today.getFullYear(), today.getMonth(), 1)) return new Date(year, month, 0).getDate();
    if (year === today.getFullYear() && month === today.getMonth() + 1) return today.getDate();
    return new Date(year, month, 0).getDate();
  }
  if (year > today.getFullYear()) return 365;
  if (year < today.getFullYear()) return (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000;
  const start = new Date(year, 0, 1);
  return Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - start) / 86400000) + 1;
}

function renderStats(items) {
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const average = total / Math.max(1, elapsedDays());
  document.querySelector("#totalSpent").textContent = money.format(total);
  document.querySelector("#totalCaption").textContent = periodLabel();
  document.querySelector("#averageSpent").textContent = money.format(average);
  document.querySelector("#averageLabel").textContent = activePeriod === "day" ? "DÉPENSES / JOUR" : "MOYENNE / JOUR";
  document.querySelector("#averageCaption").textContent = activePeriod === "day" ? "Total du jour sélectionné" : "Par jour sur la période";
  document.querySelector("#transactionCount").textContent = String(items.length);
  document.querySelector("#transactionCaption").textContent = items.length > 1 ? "Dépenses enregistrées" : "Dépense enregistrée";
  document.querySelector("#chartTotal").textContent = money.format(total);
  document.querySelector("#chartPeriodLabel").textContent = periodLabel();
}

function renderBudget() {
  const month = selectedDate.slice(0, 7);
  const monthDate = localDate(`${month}-01`);
  const budget = monthlyBudgets[month] || 0;
  const spent = expenses.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + Number(item.amount), 0);
  const remaining = budget - spent;
  const progress = document.querySelector("#budgetProgress");
  const percent = budget ? Math.min(100, spent / budget * 100) : 0;

  document.querySelector("#budgetMonth").textContent = `${monthName.format(monthDate)} ${monthDate.getFullYear()}`;
  document.querySelector("#budgetSpent").textContent = money.format(spent);
  document.querySelector("#budgetLimit").textContent = budget ? money.format(budget) : "Non défini";
  document.querySelector("#budgetStatus").textContent = !budget
    ? "Définissez une limite pour suivre vos dépenses du mois."
    : remaining >= 0
      ? `Il vous reste ${money.format(remaining)}.`
      : `Budget dépassé de ${money.format(-remaining)}.`;
  document.querySelector("#budgetProgressFill").style.width = `${percent}%`;
  document.querySelector("#openBudgetDialog").textContent = budget ? "Modifier le budget" : "Définir un budget";
  document.querySelector("#monthlyBudget").classList.toggle("is-over-budget", budget > 0 && spent > budget);
  progress.setAttribute("aria-valuemax", String(budget || 100));
  progress.setAttribute("aria-valuenow", String(budget ? Math.min(spent, budget) : 0));
  progress.setAttribute("aria-valuetext", budget ? `${money.format(spent)} dépensés sur ${money.format(budget)}` : "Aucun budget défini");
}

function chartBuckets(items) {
  if (activePeriod === "day") {
    const totals = new Map();
    for (const item of items) totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount));
    return categories.map((category) => ({ label: category.name, value: totals.get(category.name) || 0, color: category.color })).filter((bucket) => bucket.value > 0);
  }
  if (activePeriod === "year") {
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      const value = items.filter((item) => item.date.slice(5, 7) === month).reduce((sum, item) => sum + Number(item.amount), 0);
      return { label: monthName.format(new Date(Number(selectedDate.slice(0, 4)), index, 1)).slice(0, 3), value };
    });
  }
  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7));
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const value = items.filter((item) => item.date.slice(8, 10) === day).reduce((sum, item) => sum + Number(item.amount), 0);
    return { label: index === 0 || index % 5 === 0 || index === count - 1 ? String(index + 1) : "", value };
  });
}

function renderChart(items) {
  const plot = document.querySelector("#chartPlot");
  const buckets = chartBuckets(items);
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const isCategory = activePeriod === "day";
  plot.classList.toggle("is-category", isCategory);
  plot.style.minWidth = !isCategory && activePeriod === "month" && buckets.length > 24 ? `${buckets.length * 22}px` : "100%";
  plot.setAttribute("aria-label", isCategory ? "Dépenses par catégorie pour le jour sélectionné" : activePeriod === "month" ? "Dépenses par jour du mois sélectionné" : "Dépenses par mois de l'année sélectionnée");
  document.querySelector("#chartTitle").textContent = isCategory ? "Dépenses du jour" : "Rythme des dépenses";
  document.querySelector("#chartDescription").textContent = isCategory ? "Répartition par catégorie" : activePeriod === "month" ? "Dépenses par jour" : "Dépenses par mois";
  plot.replaceChildren();
  for (const [index, bucket] of buckets.entries()) {
    const column = document.createElement("div");
    column.className = "chart-column";
    column.style.setProperty("--stagger", `${Math.min(index, 8) * 22}ms`);
    const track = document.createElement("div");
    track.className = "chart-bar-track";
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${bucket.value ? Math.max(3, bucket.value / max * 100) : 1}%`;
    if (bucket.color) bar.style.backgroundColor = bucket.color;
    bar.title = `${bucket.label} : ${money.format(bucket.value)}`;
    track.append(bar);
    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = bucket.label;
    column.append(track, label);
    plot.append(column);
  }
}

function renderCategories(items) {
  const totals = new Map();
  for (const item of items) totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount));
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const list = document.querySelector("#categoryList");
  const empty = document.querySelector("#categoryEmpty");
  list.replaceChildren();
  document.querySelector("#categoryCount").textContent = String(sorted.length);
  document.querySelector("#categoryTotal").textContent = money.format(items.reduce((sum, item) => sum + Number(item.amount), 0));
  empty.classList.toggle("is-visible", sorted.length === 0);
  for (const [index, [name, amount]] of sorted.entries()) {
    const category = categoryByName.get(name);
    const row = document.createElement("div");
    row.className = "category-row";
    row.style.setProperty("--stagger", `${index * 35}ms`);
    const top = document.createElement("div");
    top.className = "category-row-top";
    const title = document.createElement("span");
    title.className = "category-name";
    const dot = document.createElement("i");
    dot.className = "category-dot";
    dot.style.backgroundColor = category.color;
    const text = document.createElement("span");
    text.textContent = name;
    const value = document.createElement("span");
    value.className = "category-amount";
    value.textContent = money.format(amount);
    title.append(dot, text);
    top.append(title, value);
    const track = document.createElement("div");
    track.className = "category-track";
    const fill = document.createElement("div");
    fill.className = "category-fill";
    fill.style.width = `${amount / sorted[0][1] * 100}%`;
    fill.style.backgroundColor = category.color;
    track.append(fill);
    row.append(top, track);
    list.append(row);
  }
}

function renderExpenseList(items) {
  const selectedCategory = document.querySelector("#categoryFilter").value;
  const filtered = [...items].filter((item) => selectedCategory === "all" || item.category === selectedCategory).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = document.querySelector("#expenseList");
  const empty = document.querySelector("#emptyState");
  list.replaceChildren();
  document.querySelector("#visibleCount").textContent = String(filtered.length);
  const noItems = filtered.length === 0;
  empty.classList.toggle("is-visible", noItems);
  empty.querySelector("strong").textContent = items.length && selectedCategory !== "all" ? "Aucune dépense dans cette catégorie" : "Aucune dépense pour cette période";
  empty.querySelector("span:not(.empty-mark)").textContent = items.length && selectedCategory !== "all" ? "Essayez une autre catégorie pour afficher vos dépenses." : "Ajoutez votre première dépense pour commencer le suivi.";
  for (const [index, item] of filtered.entries()) {
    const category = categoryByName.get(item.category);
    const row = document.createElement("article");
    row.className = "expense-row";
    row.style.setProperty("--stagger", `${Math.min(index, 8) * 35}ms`);
    const main = document.createElement("div");
    main.className = "expense-main";
    const symbol = document.createElement("span");
    symbol.className = "expense-symbol";
    symbol.style.backgroundColor = category.tint;
    symbol.style.color = category.color;
    symbol.textContent = category.mark;
    const titleWrap = document.createElement("div");
    titleWrap.className = "expense-title-wrap";
    const title = document.createElement("div");
    title.className = "expense-name";
    title.textContent = item.name;
    titleWrap.append(title);
    if (item.note) {
      const note = document.createElement("div");
      note.className = "expense-note";
      note.textContent = item.note;
      titleWrap.append(note);
    }
    main.append(symbol, titleWrap);
    const categoryTag = document.createElement("span");
    categoryTag.className = "expense-category";
    categoryTag.style.backgroundColor = category.tint;
    categoryTag.style.color = category.color;
    categoryTag.textContent = item.category;
    const date = document.createElement("time");
    date.className = "expense-date";
    date.dateTime = item.date;
    date.textContent = shortDate.format(localDate(item.date));
    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = money.format(Number(item.amount));
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.dataset.deleteId = item.id;
    remove.setAttribute("aria-label", `Supprimer ${item.name}`);
    remove.title = "Supprimer cette dépense";
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 11v6m4-6v6M6.5 7l.8 13h9.4l.8-13M9 7V4.5h6V7"/></svg>';
    row.append(main, categoryTag, date, amount, remove);
    list.append(row);
  }
}

function render() {
  syncPeriodInput();
  document.querySelector("#walletBalance").textContent = money.format(walletBalance);
  const items = periodExpenses();
  renderStats(items);
  renderBudget();
  renderChart(items);
  renderCategories(items);
  renderExpenseList(items);
}

function populateCategoryOptions() {
  const expenseCategory = document.querySelector("#expenseCategory");
  const categoryFilter = document.querySelector("#categoryFilter");
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    expenseCategory.append(option);
    const filterOption = option.cloneNode(true);
    categoryFilter.append(filterOption);
  }
}

function openDialog() {
  expenseForm.reset();
  document.querySelector("#expenseDate").value = selectedDate;
  updateExpensePreview();
  expenseDialog.showModal();
  document.querySelector("#expenseName").focus();
}

function updateExpensePreview() {
  const amount = Math.round(Number(document.querySelector("#expenseAmount").value));
  const preview = document.querySelector("#expenseWalletPreview");
  const hasAmount = document.querySelector("#expenseAmount").value !== "" && Number.isFinite(amount) && amount > 0;
  const insufficient = hasAmount && amount > walletBalance;
  preview.classList.toggle("is-insufficient", insufficient);
  preview.textContent = !hasAmount
    ? `Solde disponible : ${money.format(walletBalance)}. Saisissez un montant pour voir le solde restant.`
    : insufficient
      ? `Solde insuffisant : ${money.format(walletBalance)} disponibles.`
      : `Solde après dépense : ${money.format(walletBalance - amount)}`;
}

function openWalletDialog() {
  walletForm.reset();
  document.querySelector("#walletDialogBalance").textContent = money.format(walletBalance);
  walletDialog.showModal();
  document.querySelector("#walletAmount").focus();
}

function openBudgetDialog() {
  budgetForm.reset();
  const monthInput = document.querySelector("#budgetMonthInput");
  monthInput.value = selectedDate.slice(0, 7);
  document.querySelector("#budgetAmount").value = monthlyBudgets[monthInput.value] || "";
  budgetDialog.showModal();
  document.querySelector("#budgetAmount").focus();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function exportCsv() {
  const items = periodExpenses();
  if (!items.length) {
    showToast("Aucune dépense à exporter pour cette période.");
    return;
  }
  const escapeCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [["Date", "Dépense", "Catégorie", "Montant (FCFA)", "Note"], ...items.map((item) => [item.date, item.name, item.category, Number(item.amount).toFixed(0), item.note || ""])];
  const content = `\uFEFF${rows.map((row) => row.map(escapeCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clair-depenses-${currentPeriodValue()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Export CSV téléchargé.");
}

document.querySelectorAll(".period-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activePeriod = tab.dataset.period;
    document.querySelectorAll(".period-tab").forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
});

periodInput.addEventListener("change", () => {
  setSelectedDate(periodInput.value);
  render();
});

document.querySelector("#openExpenseDialog").addEventListener("click", openDialog);
document.querySelector("#emptyAddButton").addEventListener("click", openDialog);
document.querySelector("#expenseAmount").addEventListener("input", updateExpensePreview);
document.querySelector("#closeExpenseDialog").addEventListener("click", () => expenseDialog.close());
document.querySelector("#cancelExpense").addEventListener("click", () => expenseDialog.close());
document.querySelector("#openWalletDialog").addEventListener("click", openWalletDialog);
document.querySelector("#closeWalletDialog").addEventListener("click", () => walletDialog.close());
document.querySelector("#cancelWallet").addEventListener("click", () => walletDialog.close());
document.querySelector("#openBudgetDialog").addEventListener("click", openBudgetDialog);
document.querySelector("#closeBudgetDialog").addEventListener("click", () => budgetDialog.close());
document.querySelector("#cancelBudget").addEventListener("click", () => budgetDialog.close());
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#categoryFilter").addEventListener("change", () => renderExpenseList(periodExpenses()));

expenseDialog.addEventListener("click", (event) => {
  if (event.target === expenseDialog) expenseDialog.close();
});

walletDialog.addEventListener("click", (event) => {
  if (event.target === walletDialog) walletDialog.close();
});

budgetDialog.addEventListener("click", (event) => {
  if (event.target === budgetDialog) budgetDialog.close();
});

document.querySelector("#budgetMonthInput").addEventListener("change", (event) => {
  document.querySelector("#budgetAmount").value = monthlyBudgets[event.target.value] || "";
});

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!budgetForm.reportValidity()) return;
  const formData = new FormData(budgetForm);
  const month = String(formData.get("month"));
  const amount = Math.round(Number(formData.get("amount")));
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount <= 0) return;
  const previousBudget = monthlyBudgets[month];
  monthlyBudgets[month] = amount;
  if (!saveMonthlyBudgets()) {
    if (previousBudget === undefined) delete monthlyBudgets[month];
    else monthlyBudgets[month] = previousBudget;
    return;
  }
  budgetDialog.close();
  selectedDate = `${month}-01`;
  render();
  showToast("Budget mensuel enregistré.");
});

walletForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!walletForm.reportValidity()) return;
  const amount = Math.round(Number(new FormData(walletForm).get("amount")));
  if (!Number.isFinite(amount) || amount <= 0) return;
  walletBalance += amount;
  if (!saveWalletBalance()) {
    walletBalance -= amount;
    return;
  }
  walletDialog.close();
  render();
  showToast("Fonds ajoutés au portefeuille.");
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!expenseForm.reportValidity()) return;
  const formData = new FormData(expenseForm);
  const amount = Math.round(Number(formData.get("amount")));
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (amount > walletBalance) {
    showToast("Solde insuffisant. Ajoutez des fonds au portefeuille.");
    return;
  }
  expenses.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(formData.get("name")).trim(),
    amount,
    category: String(formData.get("category")),
    date: String(formData.get("date")),
    note: String(formData.get("note")).trim(),
    walletDebited: true,
  });
  walletBalance -= amount;
  const saved = saveExpenses();
  const walletSaved = saveWalletBalance();
  if (!saved || !walletSaved) {
    expenses.pop();
    walletBalance += amount;
    if (saved) saveExpenses();
    if (walletSaved) saveWalletBalance();
    render();
    return;
  }
  expenseDialog.close();
  const entryDate = String(formData.get("date"));
  if (activePeriod === "day") setSelectedDate(entryDate, "day");
  else if (activePeriod === "month") setSelectedDate(entryDate.slice(0, 7), "month");
  else setSelectedDate(entryDate.slice(0, 4), "year");
  render();
  if (saved) showToast("Dépense enregistrée.");
});

document.querySelector("#expenseList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const removedExpense = expenses.find((item) => item.id === button.dataset.deleteId);
  expenses = expenses.filter((item) => item.id !== button.dataset.deleteId);
  if (removedExpense?.walletDebited) walletBalance += Number(removedExpense.amount);
  const expensesSaved = saveExpenses();
  const walletSaved = !removedExpense?.walletDebited || saveWalletBalance();
  if (!expensesSaved || !walletSaved) {
    if (removedExpense) expenses.push(removedExpense);
    if (removedExpense?.walletDebited) walletBalance -= Number(removedExpense.amount);
    if (expensesSaved) saveExpenses();
    if (walletSaved && removedExpense?.walletDebited) saveWalletBalance();
    render();
    return;
  }
  showToast("Dépense supprimée et solde rétabli.");
  render();
});

document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(today);
const themeSelect = document.querySelector("#themeSelect");
themeSelect.value = savedTheme;
themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  if (!availableThemes.includes(theme)) return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    showToast("Le thème ne peut pas être enregistré sur cet appareil.");
  }
});
populateCategoryOptions();
document.querySelector("#expenseDate").value = selectedDate;
render();