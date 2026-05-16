import {
  loginWithEmail,
  loginWithGoogle,
  redirectIfLoggedIn,
  registerWithEmail,
  sendResetEmail
} from "./firebaseClient.js";
import { verifyToken } from "./api.js";
import { clearMessage, showMessage } from "./ui.js";

let isSubmitting = false;
redirectIfLoggedIn(() => !isSubmitting);

const form = document.querySelector("[data-auth-form]");
const mode = form?.dataset.mode;
const googleButton = document.querySelector("[data-google-auth]");
const resetButton = document.querySelector("[data-reset-password]");

async function completeAuth(credential) {
  localStorage.setItem("vet_uid", credential.user.uid);
  localStorage.setItem("vet_email", credential.user.email || "");
  await verifyToken();
  window.location.href = "dashboard.html";
}

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

    await completeAuth(credential);
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    submitButton.disabled = false;
    isSubmitting = false;
  }
});

googleButton?.addEventListener("click", async () => {
  clearMessage("formMessage");
  googleButton.disabled = true;
  isSubmitting = true;

  try {
    const credential = await loginWithGoogle();
    await completeAuth(credential);
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    googleButton.disabled = false;
    isSubmitting = false;
  }
});

resetButton?.addEventListener("click", async () => {
  clearMessage("formMessage");

  const email = form?.email.value.trim();
  if (!email) {
    showMessage("formMessage", "Enter your email address, then use forgot password.");
    form?.email.focus();
    return;
  }

  resetButton.disabled = true;

  try {
    await sendResetEmail(email);
    showMessage("formMessage", "Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    showMessage("formMessage", error.message);
  } finally {
    resetButton.disabled = false;
  }
});
