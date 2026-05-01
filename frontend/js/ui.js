export function showMessage(elementId, message, type = "error") {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.className = `message ${type}`;
}

export function clearMessage(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = "";
  element.className = "message";
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function setActiveNav() {
  const page = window.location.pathname.split("/").pop();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === page);
  });
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
