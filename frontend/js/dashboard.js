import { deleteExpense, getExpenses, getVehicles, updateExpense, verifyToken } from "./api.js";
import { logout, requireAuth } from "./firebaseClient.js";
import { formatCurrency, formatDate, registerServiceWorker, setActiveNav, showMessage } from "./ui.js";

let currentUser;
let vehicles = [];
let allExpenses = [];
let chart;
let selectedExpenseId = null;

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function vehicleName(vehicleId) {
  return vehicles.find((vehicle) => vehicle.id === vehicleId)?.vehicleName || "Vehicle";
}

function renderVehicles(selectedVehicleId = "") {
  const filter = document.getElementById("vehicleFilter");
  const editExpenseVehicle = document.querySelector("#editExpenseForm select[name='vehicleId']");
  const options = vehicles
    .map((vehicle) => `<option value="${vehicle.id}">${escapeHtml(vehicle.vehicleName)} (${escapeHtml(vehicle.number)})</option>`)
    .join("");

  if (filter) {
    filter.innerHTML = `<option value="">All vehicles</option>${options}`;
    filter.value = selectedVehicleId;
  }

  if (editExpenseVehicle) {
    editExpenseVehicle.innerHTML = options;
  }
}

function renderSummary(total, monthlySummary) {
  document.getElementById("totalExpenses").textContent = formatCurrency(total);
  const monthKeys = Object.keys(monthlySummary).sort();
  const currentMonth = new Date().toISOString().slice(0, 7);
  document.getElementById("monthExpenses").textContent = formatCurrency(monthlySummary[currentMonth] || 0);
  document.getElementById("vehicleCount").textContent = vehicles.length;

  const labels = monthKeys.length ? monthKeys : [currentMonth];
  const values = labels.map((month) => monthlySummary[month] || 0);
  const context = document.getElementById("monthlyChart");

  if (chart) chart.destroy();
  chart = new Chart(context, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Monthly expenses",
          data: values,
          backgroundColor: "#2563eb",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function formatKm(value) {
  return `${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`;
}

function formatEfficiency(distance, fuelQuantity) {
  if (!distance || !fuelQuantity) return "—";
  return `${(distance / fuelQuantity).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km/L`;
}

function getExpenseTime(expense) {
  const createdAtSeconds = expense.createdAt?._seconds || expense.createdAt?.seconds;
  if (createdAtSeconds) return createdAtSeconds * 1000;
  return new Date(expense.date).getTime();
}

function buildDistanceMap(expenses) {
  const distanceMap = new Map();
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const expensesByVehicle = expenses.reduce((groups, expense) => {
    if (!groups.has(expense.vehicleId)) groups.set(expense.vehicleId, []);
    groups.get(expense.vehicleId).push(expense);
    return groups;
  }, new Map());

  expensesByVehicle.forEach((vehicleExpenses) => {
    vehicleExpenses
      .slice()
      .sort((a, b) => {
        const aOdometer = Number(a.odometer);
        const bOdometer = Number(b.odometer);

        if (Number.isFinite(aOdometer) && Number.isFinite(bOdometer) && aOdometer !== bOdometer) {
          return aOdometer - bOdometer;
        }

        return getExpenseTime(a) - getExpenseTime(b);
      })
      .forEach((expense, index, sortedExpenses) => {
        const explicitDistance = Number(expense.tripDistance || 0);
        if (explicitDistance > 0) {
          distanceMap.set(expense.id, explicitDistance);
          return;
        }

        const currentOdometer = Number(expense.odometer);
        const previousExpense = sortedExpenses[index - 1];
        const vehicle = vehicleMap.get(expense.vehicleId);
        const initialOdometer = Number(vehicle?.initialOdometer);
        const previousOdometer = previousExpense
          ? Number(previousExpense.odometer)
          : Number.isFinite(initialOdometer)
            ? initialOdometer
            : NaN;
        const derivedDistance = currentOdometer - previousOdometer;

        if (Number.isFinite(currentOdometer) && Number.isFinite(previousOdometer) && derivedDistance > 0) {
          distanceMap.set(expense.id, derivedDistance);
        }
      });
  });

  return distanceMap;
}

function calculateInsights(expenses) {
  const distanceMap = buildDistanceMap(expenses);
  const totals = {
    distance: 0,
    fuelDistance: 0,
    fuelQuantity: 0,
    amountWithDistance: 0
  };

  const byVehicle = vehicles.map((vehicle) => ({
    ...vehicle,
    total: 0,
    distance: 0,
    fuelDistance: 0,
    fuelQuantity: 0,
    amountWithDistance: 0,
    expenseCount: 0
  }));

  const byVehicleMap = new Map(byVehicle.map((vehicle) => [vehicle.id, vehicle]));

  expenses.forEach((expense) => {
    const vehicle = byVehicleMap.get(expense.vehicleId);
    const amount = Number(expense.amount || 0);
    const distance = distanceMap.get(expense.id) || 0;
    const fuelQuantity = Number(expense.fuelQuantity || 0);

    if (vehicle) {
      vehicle.total += amount;
      vehicle.expenseCount += 1;
    }

    if (distance > 0) {
      totals.distance += distance;
      totals.amountWithDistance += amount;
      if (vehicle) {
        vehicle.distance += distance;
        vehicle.amountWithDistance += amount;
      }
    }

    if (fuelQuantity > 0) {
      totals.fuelQuantity += fuelQuantity;
      if (vehicle) vehicle.fuelQuantity += fuelQuantity;

      if (distance > 0 && expense.type === "fuel") {
        totals.fuelDistance += distance;
        if (vehicle) vehicle.fuelDistance += distance;
      }
    }
  });

  return { totals, byVehicle };
}

function renderVehicleInsights(expenses) {
  const { totals, byVehicle } = calculateInsights(expenses);
  const costPerKm = totals.distance ? totals.amountWithDistance / totals.distance : null;

  document.getElementById("trackedDistance").textContent = formatKm(totals.distance);
  document.getElementById("costPerKm").textContent = costPerKm ? `${formatCurrency(costPerKm)}/km` : "—";
  document.getElementById("fuelEfficiency").textContent = formatEfficiency(totals.fuelDistance, totals.fuelQuantity);

  const list = document.getElementById("vehicleInsightList");
  const activeVehicles = byVehicle.filter((vehicle) => vehicle.expenseCount || vehicle.distance || vehicle.fuelQuantity);

  if (!activeVehicles.length) {
    list.innerHTML = `<div class="empty">Add expenses with distance or fuel quantity to unlock vehicle insights.</div>`;
    return;
  }

  list.innerHTML = activeVehicles
    .map((vehicle) => {
      const vehicleCostPerKm = vehicle.distance ? vehicle.amountWithDistance / vehicle.distance : null;
      return `
        <article class="insight-card" data-vehicle-id="${vehicle.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(vehicle.vehicleName)} expenses">
          <div>
            <p class="expense-title">${escapeHtml(vehicle.vehicleName)}</p>
            <p class="muted">${escapeHtml(vehicle.number)}</p>
          </div>
          <div class="insight-metrics">
            <span>${formatCurrency(vehicle.total)}</span>
            <span>${formatKm(vehicle.distance)}</span>
            <span>${vehicleCostPerKm ? `${formatCurrency(vehicleCostPerKm)}/km` : "—/km"}</span>
            <span>${formatEfficiency(vehicle.fuelDistance, vehicle.fuelQuantity)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildMonthlySummary(expenses) {
  return expenses.reduce((summary, expense) => {
    const month = expense.month || expense.date.slice(0, 7);
    summary[month] = (summary[month] || 0) + Number(expense.amount || 0);
    return summary;
  }, {});
}

function getFilteredExpenses() {
  const search = document.getElementById("searchFilter").value.trim().toLowerCase();
  const fromDate = document.getElementById("fromDateFilter").value;
  const toDate = document.getElementById("toDateFilter").value;
  const sort = document.getElementById("sortFilter").value;

  const filtered = allExpenses.filter((expense) => {
    const note = String(expense.note || "").toLowerCase();
    const vehicle = vehicleName(expense.vehicleId).toLowerCase();
    const matchesSearch = !search || note.includes(search) || vehicle.includes(search) || expense.type.includes(search);
    const matchesFrom = !fromDate || expense.date >= fromDate;
    const matchesTo = !toDate || expense.date <= toDate;
    return matchesSearch && matchesFrom && matchesTo;
  });

  filtered.sort((a, b) => {
    if (sort === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (sort === "highest") return Number(b.amount) - Number(a.amount);
    if (sort === "lowest") return Number(a.amount) - Number(b.amount);
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return filtered;
}

function renderFilteredDashboard() {
  const filtered = getFilteredExpenses();
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  renderSummary(total, buildMonthlySummary(filtered));
  renderVehicleInsights(filtered);
  renderExpenses(filtered);
}

function renderExpenses(expenses) {
  const list = document.getElementById("expenseList");
  const distanceMap = buildDistanceMap(expenses);

  if (!expenses.length) {
    list.innerHTML = `<div class="empty">No expenses yet. Add your first vehicle cost to start tracking.</div>`;
    return;
  }

  list.innerHTML = expenses
    .map(
      (expense) => `
        <article class="expense-card clickable-card" data-expense-id="${expense.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(expense.type)} expense detail">
          <div class="expense-card-actions" aria-label="Expense actions">
            <button class="icon-button" data-action="edit-expense" data-id="${expense.id}" type="button" aria-label="Edit ${escapeHtml(expense.type)} expense">
              ✎
            </button>
            <button class="icon-button danger" data-action="delete-expense" data-id="${expense.id}" type="button" aria-label="Delete ${escapeHtml(expense.type)} expense">
              ×
            </button>
          </div>
          <div>
            <p class="expense-title">${escapeHtml(expense.type)}</p>
            <p class="muted">${escapeHtml(vehicleName(expense.vehicleId))} • ${formatDate(expense.date)}</p>
            ${renderExpenseMetrics(expense, distanceMap)}
            ${expense.note ? `<p class="note">${escapeHtml(expense.note)}</p>` : ""}
          </div>
          <div class="card-actions">
            <strong>${formatCurrency(expense.amount)}</strong>
          </div>
        </article>
      `
    )
    .join("");
}

function detailRow(label, value) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${value || "—"}</strong>
    </div>
  `;
}

function renderExpenseMetrics(expense, distanceMap = new Map()) {
  const metrics = [];
  if (expense.odometer !== null && expense.odometer !== undefined) metrics.push(`${Number(expense.odometer).toLocaleString("en-IN")} km odo`);
  if (expense.tripDistance) {
    metrics.push(`${Number(expense.tripDistance).toLocaleString("en-IN")} km driven`);
  } else if (distanceMap.get(expense.id)) {
    metrics.push(`${Number(distanceMap.get(expense.id)).toLocaleString("en-IN")} km driven`);
  }
  if (expense.fuelQuantity) metrics.push(`${Number(expense.fuelQuantity).toLocaleString("en-IN")} L`);
  return metrics.length ? `<p class="metric-line">${metrics.map(escapeHtml).join(" • ")}</p>` : "";
}

function optionalNumber(value) {
  return value === "" ? null : Number(value);
}

async function loadDashboard() {
  try {
    const vehicleId = document.getElementById("vehicleFilter").value;
    const vehicleResponse = await getVehicles(currentUser.uid);
    vehicles = vehicleResponse.vehicles || [];
    renderVehicles(vehicleId);

    const type = document.getElementById("categoryFilter").value;
    const expenseResponse = await getExpenses(currentUser.uid, { vehicleId, type });
    allExpenses = expenseResponse.expenses || [];

    renderFilteredDashboard();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  }
}

function resetFilters() {
  document.getElementById("vehicleFilter").value = "";
  document.getElementById("categoryFilter").value = "";
  document.getElementById("fromDateFilter").value = "";
  document.getElementById("toDateFilter").value = "";
  document.getElementById("searchFilter").value = "";
  document.getElementById("sortFilter").value = "newest";
  loadDashboard();
}

function focusVehicle(vehicleId) {
  document.getElementById("vehicleFilter").value = vehicleId;
  loadDashboard();
  document.getElementById("expenseList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleVehicleInsightClick(event) {
  const card = event.target.closest(".insight-card[data-vehicle-id]");
  if (!card) return;
  focusVehicle(card.dataset.vehicleId);
}

function handleVehicleInsightKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".insight-card[data-vehicle-id]");
  if (!card) return;
  event.preventDefault();
  focusVehicle(card.dataset.vehicleId);
}

function closeExpenseEditor() {
  document.getElementById("editExpensePanel").classList.add("is-hidden");
  document.getElementById("editExpenseForm").reset();
}

function closeExpenseDetail() {
  selectedExpenseId = null;
  document.getElementById("expenseDetailPanel").classList.add("is-hidden");
}

function openExpenseDetail(expenseId) {
  const expense = allExpenses.find((item) => item.id === expenseId);
  if (!expense) return;

  selectedExpenseId = expenseId;
  const distanceMap = buildDistanceMap(allExpenses);
  const distance = expense.tripDistance || distanceMap.get(expense.id);
  const fuelEfficiency = expense.type === "fuel" ? formatEfficiency(distance, Number(expense.fuelQuantity || 0)) : "—";

  document.getElementById("expenseDetailTitle").textContent = `${expense.type} • ${formatCurrency(expense.amount)}`;
  document.getElementById("expenseDetailBody").innerHTML = [
    detailRow("Vehicle", escapeHtml(vehicleName(expense.vehicleId))),
    detailRow("Amount", formatCurrency(expense.amount)),
    detailRow("Category", escapeHtml(expense.type)),
    detailRow("Date", formatDate(expense.date)),
    detailRow("Odometer", expense.odometer !== null && expense.odometer !== undefined ? `${Number(expense.odometer).toLocaleString("en-IN")} km` : "—"),
    detailRow("Distance", distance ? formatKm(distance) : "—"),
    detailRow("Fuel quantity", expense.fuelQuantity ? `${Number(expense.fuelQuantity).toLocaleString("en-IN")} L` : "—"),
    detailRow("Fuel efficiency", fuelEfficiency),
    detailRow("Note", escapeHtml(expense.note || "—"))
  ].join("");

  closeExpenseEditor();
  document.getElementById("expenseDetailPanel").classList.remove("is-hidden");
  document.getElementById("expenseDetailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openExpenseEditor(expenseId) {
  const expense = allExpenses.find((item) => item.id === expenseId);
  if (!expense) return;

  closeExpenseDetail();
  const form = document.getElementById("editExpenseForm");
  form.expenseId.value = expense.id;
  form.vehicleId.value = expense.vehicleId;
  form.amount.value = expense.amount;
  form.type.value = expense.type;
  form.date.value = expense.date;
  form.odometer.value = expense.odometer ?? "";
  form.fuelQuantity.value = expense.fuelQuantity ?? "";
  form.note.value = expense.note || "";
  syncEditFuelQuantityVisibility();

  document.getElementById("editExpensePanel").classList.remove("is-hidden");
  document.getElementById("editExpensePanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncEditFuelQuantityVisibility() {
  const form = document.getElementById("editExpenseForm");
  const label = document.getElementById("editFuelQuantityLabel");
  const isFuel = form.type.value === "fuel";
  label.classList.toggle("is-hidden", !isFuel);
  form.fuelQuantity.disabled = !isFuel;
  if (!isFuel) {
    form.fuelQuantity.value = "";
  }
}

async function handleExpenseListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (button) {
    const expenseId = button.dataset.id;
    if (button.dataset.action === "edit-expense") {
      openExpenseEditor(expenseId);
      return;
    }

    if (button.dataset.action === "delete-expense") {
      await deleteSelectedExpense(expenseId);
      return;
    }
  }

  const card = event.target.closest(".expense-card[data-expense-id]");
  if (card) openExpenseDetail(card.dataset.expenseId);
}

function handleExpenseListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".expense-card[data-expense-id]");
  if (!card) return;
  event.preventDefault();
  openExpenseDetail(card.dataset.expenseId);
}

async function deleteSelectedExpense(expenseId) {
  const confirmed = window.confirm("Delete this expense? This cannot be undone.");
  if (!confirmed) return;

  try {
    await deleteExpense(expenseId);
    showMessage("dashboardMessage", "Expense deleted.", "success");
    closeExpenseEditor();
    closeExpenseDetail();
    await loadDashboard();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  }
}

async function handleExpenseDetailClick(event) {
  const button = event.target.closest("button[data-detail-action]");
  if (!button) return;

  if (button.dataset.detailAction === "close-expense") {
    closeExpenseDetail();
    return;
  }

  if (!selectedExpenseId) return;
  if (button.dataset.detailAction === "edit-expense") openExpenseEditor(selectedExpenseId);
  if (button.dataset.detailAction === "delete-expense") await deleteSelectedExpense(selectedExpenseId);
}

async function handleExpenseEditSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await updateExpense(form.expenseId.value, {
      vehicleId: form.vehicleId.value,
      amount: Number(form.amount.value),
      type: form.type.value,
      note: form.note.value.trim(),
      date: form.date.value,
      odometer: optionalNumber(form.odometer.value),
      fuelQuantity: optionalNumber(form.fuelQuantity.value)
    });
    showMessage("dashboardMessage", "Expense updated.", "success");
    closeExpenseEditor();
    await loadDashboard();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  } finally {
    submitButton.disabled = false;
  }
}

requireAuth(async (user) => {
  currentUser = user;
  registerServiceWorker();
  setActiveNav();
  document.getElementById("userEmail").textContent = user.email || "Signed in";
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("vehicleFilter").addEventListener("change", loadDashboard);
  document.getElementById("categoryFilter").addEventListener("change", loadDashboard);
  document.getElementById("fromDateFilter").addEventListener("change", renderFilteredDashboard);
  document.getElementById("toDateFilter").addEventListener("change", renderFilteredDashboard);
  document.getElementById("sortFilter").addEventListener("change", renderFilteredDashboard);
  document.getElementById("searchFilter").addEventListener("input", renderFilteredDashboard);
  document.getElementById("clearFiltersButton").addEventListener("click", resetFilters);
  document.getElementById("expenseList").addEventListener("click", handleExpenseListClick);
  document.getElementById("expenseList").addEventListener("keydown", handleExpenseListKeydown);
  document.getElementById("expenseDetailPanel").addEventListener("click", handleExpenseDetailClick);
  document.getElementById("vehicleInsightList").addEventListener("click", handleVehicleInsightClick);
  document.getElementById("vehicleInsightList").addEventListener("keydown", handleVehicleInsightKeydown);
  document.getElementById("editExpenseForm").addEventListener("submit", handleExpenseEditSubmit);
  document.querySelector("#editExpenseForm select[name='type']").addEventListener("change", syncEditFuelQuantityVisibility);
  document.getElementById("cancelExpenseEditButton").addEventListener("click", closeExpenseEditor);
  await verifyToken();
  const flash = sessionStorage.getItem("vet_flash");
  if (flash) {
    showMessage("dashboardMessage", flash, "success");
    sessionStorage.removeItem("vet_flash");
  }
  await loadDashboard();
});
