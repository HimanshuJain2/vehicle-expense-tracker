import { addExpense, getVehicles, verifyToken } from "./api.js";
import { logout, requireAuth } from "./firebaseClient.js";
import { clearMessage, registerServiceWorker, setActiveNav, showMessage } from "./ui.js";

let currentUser;

async function loadVehicles() {
  const select = document.getElementById("vehicleId");
  let vehicles = [];

  try {
    const response = await getVehicles(currentUser.uid);
    vehicles = response.vehicles || [];
  } catch (error) {
    select.innerHTML = `<option value="">Unable to load vehicles</option>`;
    select.disabled = true;
    showMessage("formMessage", error.message);
    return;
  }

  select.innerHTML = vehicles.length
    ? vehicles.map((vehicle) => `<option value="${vehicle.id}">${vehicle.vehicleName} (${vehicle.number})</option>`).join("")
    : `<option value="">Add a vehicle first</option>`;
  select.disabled = !vehicles.length;
}

function optionalNumber(value) {
  return value === "" ? null : Number(value);
}

function syncFuelQuantityVisibility() {
  const form = document.getElementById("expenseForm");
  const label = document.getElementById("fuelQuantityLabel");
  const isFuel = form.type.value === "fuel";
  label.classList.toggle("is-hidden", !isFuel);
  form.fuelQuantity.disabled = !isFuel;
  if (!isFuel) {
    form.fuelQuantity.value = "";
  }
}

requireAuth(async (user) => {
  currentUser = user;
  registerServiceWorker();
  setActiveNav();
  document.getElementById("userEmail").textContent = user.email || "Signed in";
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#expenseForm select[name='type']").addEventListener("change", syncFuelQuantityVisibility);
  syncFuelQuantityVisibility();
  await verifyToken();
  await loadVehicles();
});

document.getElementById("expenseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage("formMessage");

  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await addExpense({
      vehicleId: form.vehicleId.value,
      amount: Number(form.amount.value),
      type: form.type.value,
      note: form.note.value.trim(),
      date: form.date.value,
      odometer: optionalNumber(form.odometer.value),
      fuelQuantity: optionalNumber(form.fuelQuantity.value)
    });
    showMessage("formMessage", "Expense added successfully.", "success");
    form.reset();
    sessionStorage.setItem("vet_flash", "Expense added successfully.");
    window.location.href = "dashboard.html";
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    submitButton.disabled = false;
  }
});
