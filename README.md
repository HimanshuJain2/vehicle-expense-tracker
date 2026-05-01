# Vehicle Expense Tracker

Production-ready starter for a Vehicle Expense Tracker Android app that uses:

- Android WebView shell
- Vanilla HTML/CSS/JavaScript frontend
- Node.js + Express backend
- Firebase Authentication and Firestore

## Project Structure

```text
backend/
  controllers/
    authController.js
    expenseController.js
    vehicleController.js
  middleware/
    authMiddleware.js
  routes/
    authRoutes.js
    expenseRoutes.js
    vehicleRoutes.js
  .env.example
  firebase.js
  package.json
  server.js
frontend/
  css/
    styles.css
  js/
    addExpense.js
    addVehicle.js
    api.js
    auth.js
    config.js
    dashboard.js
    firebaseClient.js
    ui.js
  add-expense.html
  add-vehicle.html
  dashboard.html
  login.html
  package.json
  register.html
  sw.js
android/
  app/
    build.gradle
    src/main/
      AndroidManifest.xml
      java/com/example/vehicleexpensetracker/MainActivity.kt
      res/
  build.gradle
  settings.gradle
```

## Firebase Setup

1. Create a Firebase project in the Firebase Console.
2. Enable Authentication -> Sign-in method -> Email/Password.
3. Create a Firestore database.
4. Add a Web App in Firebase project settings.
5. Copy the Web App config into `frontend/js/config.js`.
6. Go to Project settings -> Service accounts -> Generate new private key.
7. Save the downloaded file as `backend/serviceAccountKey.json`.
8. Copy `backend/.env.example` to `backend/.env`.

## Backend Environment

```bash
PORT=5050
CLIENT_ORIGIN=http://localhost:3000
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

The backend verifies Firebase ID tokens on every protected endpoint and extracts the UID from the token. It does not trust a writable `userId` from the frontend.

## Run Locally

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm start
```

Open:

```text
http://localhost:3000/login.html
```

Android:

1. Open the `android` folder in Android Studio.
2. Start the backend on port `5050`.
3. Start the frontend on port `3000`.
4. Run the app on an emulator.

The Android emulator uses `http://10.0.2.2:3000/login.html` to reach your machine's local frontend server. The frontend automatically calls `http://10.0.2.2:5050/api` when loaded from the emulator and `http://localhost:5050/api` in a desktop browser. For a hosted frontend, update `FRONTEND_URL` in `android/app/build.gradle` and set `vet_api_base_url` in localStorage or edit `frontend/js/config.js`.

## API Routes

All routes below require `Authorization: Bearer <firebase-id-token>` except the health check.

```text
GET  /health
POST /api/auth/verifyToken
POST /api/vehicle/add
GET  /api/vehicle/:userId
PUT  /api/vehicle/:vehicleId
DELETE /api/vehicle/:vehicleId
POST /api/expense/add
GET  /api/expense/:userId
PUT  /api/expense/:expenseId
DELETE /api/expense/:expenseId
```

## Firestore Collections

`users`

```json
{
  "uid": "firebase-auth-uid",
  "email": "driver@example.com",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp",
  "lastLoginAt": "server timestamp"
}
```

`vehicles`

```json
{
  "userId": "firebase-auth-uid",
  "vehicleName": "Honda City",
  "number": "DL 01 AB 1234",
  "type": "car",
  "initialOdometer": 40000,
  "currentOdometer": 45210,
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

`expenses`

```json
{
  "userId": "firebase-auth-uid",
  "vehicleId": "vehicle-document-id",
  "amount": 3200,
  "type": "service",
  "note": "Oil change and filters",
  "date": "2026-05-01",
  "odometer": 45210,
  "fuelQuantity": null,
  "month": "2026-05",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

## Sample Test Data

Create a user through the app, add these vehicles, then add expenses from the UI.

Vehicles:

```json
[
  {
    "vehicleName": "Honda City",
    "number": "DL 01 AB 1234",
    "type": "car"
  },
  {
    "vehicleName": "Royal Enfield Classic",
    "number": "DL 02 XY 6789",
    "type": "bike"
  }
]
```

Expenses:

```json
[
  {
    "amount": 3200,
    "type": "service",
    "note": "Oil change and filters",
    "date": "2026-05-01"
  },
  {
    "amount": 2500,
    "type": "fuel",
    "note": "Full tank refill",
    "date": "2026-05-03"
  },
  {
    "amount": 12000,
    "type": "insurance",
    "note": "Annual renewal",
    "date": "2026-04-15"
  }
]
```

## Notes

- Firebase Auth persists browser sessions by default; the frontend also stores `vet_uid` and `vet_email` in `localStorage`.
- The service worker caches static frontend files for basic offline loading.
- Dashboard filters support vehicle and expense category.
- The monthly chart uses Chart.js from CDN.
