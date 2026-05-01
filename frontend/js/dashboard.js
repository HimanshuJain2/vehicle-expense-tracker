import { getExpenses, getVehicles, verifyToken } from "./api.js";
import { logout, requireAuth } from "./firebaseClient.js";
import { formatCurrency, formatDate, registerServiceWorker, setActiveNav, showMessage } from "./ui.js";

let currentUser;
let vehicles = [];
let chart;

function vehicleName(vehicleId) {
  return vehicles.find((vehicle) => vehicle.id === vehicleId)?.vehicleName || "Vehicle";
}

function renderVehicles() {
  const filter = document.getElementById("vehicleFilter");
  const expenseVehicle = document.getElementById("expenseVehicleFilter");
  const options = vehicles
    .map((vehicle) => `<option value="${vehicle.id}">${vehicle.vehicleName} (${vehicle.number})</option>`)
    .join("");

  if (filter) {
    filter.innerHTML = `<option value="">All vehicles</option>${options}`;
  }

  if (expenseVehicle) {
    expenseVehicle.innerHTML = `<option value="">All vehicles</option>${options}`;
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

function renderExpenses(expenses) {
  const list = document.getElementById("expenseList");

  if (!expenses.length) {
    list.innerHTML = `<div class="empty">No expenses yet. Add your first vehicle cost to start tracking.</div>`;
    return;
  }

  list.innerHTML = expenses
    .map(
      (expense) => `
        <article class="expense-card">
          <div>
            <p class="expense-title">${expense.type}</p>
            <p class="muted">${vehicleName(expense.vehicleId)} • ${formatDate(expense.date)}</p>
            ${expense.note ? `<p class="note">${expense.note}</p>` : ""}
          </div>
          <strong>${formatCurrency(expense.amount)}</strong>
        </article>
      `
    )
    .join("");
}

async function loadDashboard() {
  try {
    const vehicleResponse = await getVehicles(currentUser.uid);
    vehicles = vehicleResponse.vehicles || [];
    renderVehicles();

    const vehicleId = document.getElementById("vehicleFilter").value;
    const type = document.getElementById("categoryFilter").value;
    const expenseResponse = await getExpenses(currentUser.uid, { vehicleId, type });

    renderSummary(expenseResponse.total || 0, expenseResponse.monthlySummary || {});
    renderExpenses(expenseResponse.expenses || []);
  } catch (error) {
    showMessage("dashboardMessage", error.message);
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
  await verifyToken();
  const flash = sessionStorage.getItem("vet_flash");
  if (flash) {
    showMessage("dashboardMessage", flash, "success");
    sessionStorage.removeItem("vet_flash");
  }
  await loadDashboard();
});
