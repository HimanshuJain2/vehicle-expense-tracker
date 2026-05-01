import { addVehicle, getVehicles, verifyToken } from "./api.js";
import { logout, requireAuth } from "./firebaseClient.js";
import { clearMessage, registerServiceWorker, setActiveNav, showMessage } from "./ui.js";

let currentUser;

const vehicleIcons = {
  car: "🚗",
  bike: "🏍️",
  scooter: "🛵",
  truck: "🚚",
  other: "✨"
};

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

function closeVehicleForm() {
  document.getElementById("vehicleFormPanel").classList.add("is-hidden");
  document.getElementById("showVehicleFormButton").classList.remove("is-hidden");
}

function openVehicleForm() {
  document.getElementById("vehicleFormPanel").classList.remove("is-hidden");
  document.getElementById("showVehicleFormButton").classList.add("is-hidden");
  document.querySelector("#vehicleForm input[name='vehicleName']").focus();
}

function renderVehicles(vehicles) {
  const list = document.getElementById("vehicleList");

  if (!vehicles.length) {
    list.innerHTML = `<div class="empty">No vehicles added yet.</div>`;
    return;
  }

  list.innerHTML = vehicles
    .map(
      (vehicle) => {
        const type = escapeHtml(vehicle.type || "other");
        return `
        <article class="vehicle-card">
          <div class="vehicle-icon" aria-hidden="true">${vehicleIcons[vehicle.type] || vehicleIcons.other}</div>
          <div>
            <p class="expense-title">${escapeHtml(vehicle.vehicleName)}</p>
            <p class="muted">${escapeHtml(vehicle.number)}</p>
          </div>
          <span class="badge">${type}</span>
        </article>
      `;
      }
    )
    .join("");
}

async function loadVehicles() {
  try {
    const response = await getVehicles(currentUser.uid);
    renderVehicles(response.vehicles || []);
  } catch (error) {
    showMessage("formMessage", error.message);
  }
}

requireAuth(async (user) => {
  currentUser = user;
  registerServiceWorker();
  setActiveNav();
  document.getElementById("userEmail").textContent = user.email || "Signed in";
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("showVehicleFormButton").addEventListener("click", openVehicleForm);
  await verifyToken();
  await loadVehicles();
});

document.getElementById("vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage("formMessage");
  clearMessage("pageMessage");

  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await addVehicle({
      vehicleName: form.vehicleName.value.trim(),
      number: form.number.value.trim(),
      type: form.type.value
    });
    form.reset();
    await loadVehicles();
    closeVehicleForm();
    showMessage("pageMessage", "Vehicle added successfully.", "success");
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    submitButton.disabled = false;
  }
});
