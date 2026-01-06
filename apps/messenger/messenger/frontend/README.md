# UBL Messenger Frontend

A high-fidelity messenger frontend for the UBL Foundation system.

## Prerequisites

- Node.js 18+
- UBL Kernel running on port 8080

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure the API endpoint in [.env.local](.env.local):
   ```
   VITE_API_BASE_URL=http://localhost:8080
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## Authentication

This app uses WebAuthn passkeys for authentication via the UBL Kernel identity service.
