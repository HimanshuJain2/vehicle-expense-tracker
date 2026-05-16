import { addVehicle, deleteVehicle, getVehicles, updateVehicle, verifyToken } from "./api.js";
import { logout, requireAuth } from "./firebaseClient.js";
import { clearMessage, registerServiceWorker, setActiveNav, showMessage } from "./ui.js";

let currentUser;
let vehicles = [];
let selectedVehicleId = null;

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

function optionalNumber(value) {
  return value === "" ? null : Number(value);
}

function closeVehicleForm() {
  document.getElementById("vehicleFormPanel").classList.add("is-hidden");
  document.getElementById("showVehicleFormButton").classList.remove("is-hidden");
}

function resetVehicleForm() {
  const form = document.getElementById("vehicleForm");
  form.reset();
  form.vehicleId.value = "";
  document.getElementById("vehicleSubmitButton").textContent = "Save vehicle";
  document.getElementById("cancelVehicleEditButton").classList.add("is-hidden");
}

function openVehicleForm() {
  resetVehicleForm();
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
        <article class="vehicle-card clickable-card" data-vehicle-id="${vehicle.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(vehicle.vehicleName)} detail">
          <div class="vehicle-card-top">
            <div class="vehicle-icon" aria-hidden="true">${vehicleIcons[vehicle.type] || vehicleIcons.other}</div>
            <div class="vehicle-card-actions" aria-label="Vehicle actions">
              <button class="icon-button" data-action="edit-vehicle" data-id="${vehicle.id}" type="button" aria-label="Edit ${escapeHtml(vehicle.vehicleName)}">
                ✎
              </button>
              <button class="icon-button danger" data-action="delete-vehicle" data-id="${vehicle.id}" type="button" aria-label="Delete ${escapeHtml(vehicle.vehicleName)}">
                ×
              </button>
            </div>
          </div>
          <div>
            <p class="expense-title">${escapeHtml(vehicle.vehicleName)}</p>
            <p class="muted">${escapeHtml(vehicle.number)}</p>
            ${
              vehicle.currentOdometer !== null && vehicle.currentOdometer !== undefined
                ? `<p class="metric-line">${Number(vehicle.currentOdometer).toLocaleString("en-IN")} km current</p>`
                : ""
            }
          </div>
          <div class="card-footer">
            <span class="badge">${type}</span>
          </div>
        </article>
      `;
      }
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

async function loadVehicles() {
  try {
    const response = await getVehicles(currentUser.uid);
    vehicles = response.vehicles || [];
    renderVehicles(vehicles);
  } catch (error) {
    showMessage("formMessage", error.message);
  }
}

function editVehicle(vehicleId) {
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return;

  closeVehicleDetail();
  const form = document.getElementById("vehicleForm");
  form.vehicleId.value = vehicle.id;
  form.vehicleName.value = vehicle.vehicleName;
  form.number.value = vehicle.number;
  form.type.value = vehicle.type;
  form.initialOdometer.value = vehicle.initialOdometer ?? "";

  document.getElementById("vehicleSubmitButton").textContent = "Save changes";
  document.getElementById("cancelVehicleEditButton").classList.remove("is-hidden");
  document.getElementById("vehicleFormPanel").classList.remove("is-hidden");
  document.getElementById("showVehicleFormButton").classList.add("is-hidden");
  document.getElementById("vehicleFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeVehicleDetail() {
  selectedVehicleId = null;
  document.getElementById("vehicleDetailPanel").classList.add("is-hidden");
}

function openVehicleDetail(vehicleId) {
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return;

  selectedVehicleId = vehicleId;
  document.getElementById("vehicleDetailTitle").textContent = vehicle.vehicleName;
  document.getElementById("vehicleDetailBody").innerHTML = [
    detailRow("Registration number", escapeHtml(vehicle.number)),
    detailRow("Type", escapeHtml(vehicle.type)),
    detailRow(
      "Initial odometer",
      vehicle.initialOdometer !== null && vehicle.initialOdometer !== undefined
        ? `${Number(vehicle.initialOdometer).toLocaleString("en-IN")} km`
        : "—"
    ),
    detailRow(
      "Current odometer",
      vehicle.currentOdometer !== null && vehicle.currentOdometer !== undefined
        ? `${Number(vehicle.currentOdometer).toLocaleString("en-IN")} km`
        : "—"
    )
  ].join("");

  document.getElementById("vehicleDetailPanel").classList.remove("is-hidden");
  document.getElementById("vehicleDetailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteSelectedVehicle(vehicleId) {
  const confirmed = window.confirm("Delete this vehicle? Vehicles with saved expenses cannot be deleted yet.");
  if (!confirmed) return;

  try {
    await deleteVehicle(vehicleId);
    resetVehicleForm();
    closeVehicleDetail();
    await loadVehicles();
    showMessage("pageMessage", "Vehicle deleted.", "success");
  } catch (error) {
    showMessage("pageMessage", error.message);
  }
}

async function handleVehicleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (button) {
    const vehicleId = button.dataset.id;
    if (button.dataset.action === "edit-vehicle") {
      editVehicle(vehicleId);
      return;
    }

    if (button.dataset.action === "delete-vehicle") {
      await deleteSelectedVehicle(vehicleId);
      return;
    }
  }

  const card = event.target.closest(".vehicle-card[data-vehicle-id]");
  if (card) openVehicleDetail(card.dataset.vehicleId);
}

function handleVehicleListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".vehicle-card[data-vehicle-id]");
  if (!card) return;
  event.preventDefault();
  openVehicleDetail(card.dataset.vehicleId);
}

async function handleVehicleDetailClick(event) {
  const button = event.target.closest("button[data-detail-action]");
  if (!button) return;

  if (button.dataset.detailAction === "close-vehicle") {
    closeVehicleDetail();
    return;
  }

  if (!selectedVehicleId) return;
  if (button.dataset.detailAction === "edit-vehicle") editVehicle(selectedVehicleId);
  if (button.dataset.detailAction === "delete-vehicle") await deleteSelectedVehicle(selectedVehicleId);
}

requireAuth(async (user) => {
  currentUser = user;
  registerServiceWorker();
  setActiveNav();
  document.getElementById("userEmail").textContent = user.email || "Signed in";
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("showVehicleFormButton").addEventListener("click", openVehicleForm);
  document.getElementById("cancelVehicleEditButton").addEventListener("click", () => {
    resetVehicleForm();
    closeVehicleForm();
  });
  document.getElementById("vehicleList").addEventListener("click", handleVehicleListClick);
  document.getElementById("vehicleList").addEventListener("keydown", handleVehicleListKeydown);
  document.getElementById("vehicleDetailPanel").addEventListener("click", handleVehicleDetailClick);
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
    const payload = {
      vehicleName: form.vehicleName.value.trim(),
      number: form.number.value.trim(),
      type: form.type.value,
      initialOdometer: optionalNumber(form.initialOdometer.value)
    };

    if (form.vehicleId.value) {
      await updateVehicle(form.vehicleId.value, payload);
      showMessage("pageMessage", "Vehicle updated successfully.", "success");
    } else {
      await addVehicle(payload);
      showMessage("pageMessage", "Vehicle added successfully.", "success");
    }

    resetVehicleForm();
    await loadVehicles();
    closeVehicleForm();
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    submitButton.disabled = false;
  }
});
