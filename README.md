# Time-Off Microservice

A NestJS microservice for managing employee leave requests with HCM (Human Capital Management) system integration.

## Tech Stack

- **NestJS** — framework
- **SQLite** (better-sqlite3) — local database via TypeORM
- **TypeScript** — language
- **Jest + Supertest** — testing

## Design Summary

This microservice follows a source-of-truth + cache architecture:

- **HCM is the source of truth** — every leave request is validated against HCM in real time to ensure accuracy. Local balance is never used as a validation guard.
- **Local database acts as a cache** — improves performance and provides fast reads for balance and request history.
- **Leave request flow** — request is validated (dates, overlap), balance is checked via HCM, if valid the request is stored locally and balance is updated in cache.
- **Batch synchronization** — HCM periodically sends balance updates, local cache is overwritten to stay consistent with HCM. Differences are logged as an audit trail.
- **Consistency strategy** — system favors correctness over speed by always validating against HCM. Temporary inconsistencies are resolved through batch reconciliation.
- **Concurrency handling** — database transactions ensure atomic updates, preventing double-spend in concurrent requests.
- **Degraded mode** — if HCM is unavailable, system falls back to local cache and flags the request with `validatedLocally: true` for later reconciliation.

## Prerequisites

- Node.js v18+
- npm

## Setup & Run

### 1. Clone the repository

```bash
git clone https://github.com/CysecGhost/time-off-assessment.git
cd time-off-assessment
```

### 2. Start the Mock HCM Server

The mock HCM server simulates an external HCM system on port 3001.

```bash
cd mock-hcm
npm install
node index.js
```

### 3. Start the Microservice

Open a new terminal:

```bash
cd time-off-service
npm install
npm run start:dev
```

Server runs on http://localhost:3000

## API Endpoints

| Method | Path                             | Description                         |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | /balance/:employeeId/:locationId | Get local balance                   |
| GET    | /requests/:employeeId            | Get all requests for employee       |
| POST   | /requests                        | Submit a leave request              |
| PATCH  | /requests/:id                    | Approve or reject a request         |
| POST   | /sync/batch                      | Receive batch balance sync from HCM |

## Running Tests

Make sure mock HCM is running on port 3001, then:

```bash
cd time-off-service
npm run test:e2e -- --coverage
```

## Mock HCM Endpoints

| Method | Path                             | Description                |
| ------ | -------------------------------- | -------------------------- |
| POST   | /validate                        | Validate balance           |
| GET    | /balance/:employeeId/:locationId | Get balance                |
| POST   | /bonus/:employeeId/:locationId   | Simulate anniversary bonus |
| GET    | /batch                           | Get all balances           |

## Pre-seeded HCM Employees

| employeeId | locationId | balance |
| ---------- | ---------- | ------- |
| emp1       | PK         | 20      |
| emp2       | PK         | 10      |
| emp3       | PK         | 10      |
