import { API_BASE_URL } from "./config.js";
import { auth } from "./firebaseClient.js";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be logged in.");
  }
  return user.getIdToken();
}

async function request(path, options = {}) {
  const token = await getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export function verifyToken() {
  return request("/auth/verifyToken", { method: "POST" });
}

export function addVehicle(vehicle) {
  return request("/vehicle/add", {
    method: "POST",
    body: JSON.stringify(vehicle)
  });
}

export function getVehicles(userId) {
  return request(`/vehicle/${userId}`);
}

export function updateVehicle(vehicleId, vehicle) {
  return request(`/vehicle/${vehicleId}`, {
    method: "PUT",
    body: JSON.stringify(vehicle)
  });
}

export function deleteVehicle(vehicleId) {
  return request(`/vehicle/${vehicleId}`, { method: "DELETE" });
}

export function addExpense(expense) {
  return request("/expense/add", {
    method: "POST",
    body: JSON.stringify(expense)
  });
}

export function getExpenses(userId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.vehicleId) params.set("vehicleId", filters.vehicleId);
  if (filters.type) params.set("type", filters.type);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/expense/${userId}${query}`);
}

export function updateExpense(expenseId, expense) {
  return request(`/expense/${expenseId}`, {
    method: "PUT",
    body: JSON.stringify(expense)
  });
}

export function deleteExpense(expenseId) {
  return request(`/expense/${expenseId}`, { method: "DELETE" });
}
