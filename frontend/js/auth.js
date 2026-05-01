import { loginWithEmail, redirectIfLoggedIn, registerWithEmail } from "./firebaseClient.js";
import { verifyToken } from "./api.js";
import { clearMessage, showMessage } from "./ui.js";

let isSubmitting = false;
redirectIfLoggedIn(() => !isSubmitting);

const form = document.querySelector("[data-auth-form]");
const mode = form?.dataset.mode;

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage("formMessage");

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || password.length < 6) {
    showMessage("formMessage", "Enter an email and a password with at least 6 characters.");
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  isSubmitting = true;

  try {
    const credential =
      mode === "register"
        ? await registerWithEmail(email, password)
        : await loginWithEmail(email, password);

    localStorage.setItem("vet_uid", credential.user.uid);
    localStorage.setItem("vet_email", credential.user.email || "");
    await verifyToken();
    window.location.href = "dashboard.html";
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    submitButton.disabled = false;
    isSubmitting = false;
  }
});
