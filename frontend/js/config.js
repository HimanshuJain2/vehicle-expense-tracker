export const firebaseConfig = {
  apiKey: "AIzaSyAbnDn-J9zIe7m-NvUSqIwzt9jcUZiAAJA",
  authDomain: "vehicle-expense-tracker-16bfa.firebaseapp.com",
  projectId: "vehicle-expense-tracker-16bfa",
  storageBucket: "vehicle-expense-tracker-16bfa.firebasestorage.app",
  messagingSenderId: "2725508005",
  appId: "1:2725508005:web:3547872c177a94511aae4c",
  measurementId: "G-DDS3QDRKDF"
};

const defaultApiBaseUrl =
  window.location.hostname === "10.0.2.2"
    ? "http://10.0.2.2:5050/api"
    : "http://localhost:5050/api";

export const API_BASE_URL = localStorage.getItem("vet_api_base_url") || defaultApiBaseUrl;
