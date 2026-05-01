import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  localStorage.removeItem("vet_uid");
  localStorage.removeItem("vet_email");
  await signOut(auth);
  window.location.href = "login.html";
}

export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    localStorage.setItem("vet_uid", user.uid);
    localStorage.setItem("vet_email", user.email || "");
    callback(user);
  });
}

export function redirectIfLoggedIn(shouldRedirect = () => true) {
  onAuthStateChanged(auth, (user) => {
    if (user && shouldRedirect()) {
      localStorage.setItem("vet_uid", user.uid);
      localStorage.setItem("vet_email", user.email || "");
      window.location.href = "dashboard.html";
    }
  });
}
