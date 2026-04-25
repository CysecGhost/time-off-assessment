# Technical Requirements Document (TRD)

## Time-Off Microservice

---

## 1. Overview

Build a system where an employee requests time off and the system validates their balance against HCM, stores it locally for performance, then accepts or rejects the request. The challenge is that HCM can update balances independently — work anniversaries, year-start refreshes — so keeping local data consistent requires periodic reconciliation against HCM's batch endpoint. HCM is treated as the final source of truth; all approval decisions are based on HCM validation, while local data is used as a cache for performance and display.

---

## 2. Problem Statement

Two systems manage employee leave data: HCM (external, source of truth) and our local cache (last known state). Without a dedicated microservice, there's no controlled flow for submitting requests, no protection against double-spend when concurrent requests race, and no strategy for handling balance drift when HCM updates independently. This microservice solves all three — it owns the request lifecycle, enforces balance integrity at the DB level, and stays in sync with HCM through both realtime calls and batch reconciliation.

---

## 3. System Architecture

**Controller** — receives HTTP requests, validates input shape via DTOs, delegates to the service layer, returns responses.

**Service Layer** — owns all business logic: date validation, balance checks, request decisions, and orchestration between the repository and HCM module.

**Repository / DB** — SQLite via TypeORM. Stores leave requests and local balance cache per employee per location.

**HCM Module** — dedicated wrapper for all external HCM communication. Exposes clean methods like `validateBalance()` and `deductBalance()` to the service layer. Internally handles HTTP calls, retries, and error normalization so the rest of the system doesn't care about HCM's implementation details. It implements retry logic with exponential backoff and capped attempts to handle transient failures when communicating with HCM.

**Audit Logging** — all request decisions, balance updates, and synchronization differences are logged to ensure traceability and support debugging or future audits.

---

## 4. API Design

| Method  | Path                               | Description                                       |
| ------- | ---------------------------------- | ------------------------------------------------- |
| `GET`   | `/balance/:employeeId/:locationId` | Fetch local balance for an employee at a location |
| `GET`   | `/requests/:employeeId`            | Fetch all leave requests for an employee          |
| `POST`  | `/requests`                        | Submit a new leave request                        |
| `PATCH` | `/requests/:id`                    | Approve or reject a request                       |
| `POST`  | `/sync/batch`                      | Receive batch balance update pushed from HCM      |

---

## 5. Data Models

**leave_requests**

```
id, employeeId, locationId, startDate, endDate, requestedDays, status, createdAt
```

**balances**

```
id, employeeId, locationId, balance, lastSyncAt
```

Status values: `PENDING` | `APPROVED` | `REJECTED`

---

## 6. Core Flows

### Flow 1: Employee Submits a Leave Request

1. Employee hits `POST /requests`
2. Controller receives request, validates input shape via DTOs
3. Controller passes body to service layer
4. Service layer validates dates (not in past, end > start, calculates days)
5. Service layer calls HCM module to validate balance against HCM
6. HCM says NO → reject, return 400 error
7. HCM says YES → check DB for overlapping requests for this employee
8. Overlap found → reject, return 400 error
9. No overlap → save request to DB with status `PENDING`
10. Deduct balance locally (cache update for responsiveness; HCM remains the source of truth)
11. System assumes HCM processes the deduction successfully; any discrepancies are resolved during batch reconciliation
12. Return success to employee

### Flow 2: HCM Sends Batch Sync

1. HCM hits `POST /sync/batch` with array of balance records
2. Controller receives and validates payload shape
3. Service loops through each record
4. For each record: compare HCM balance vs local balance
5. Log the difference (audit trail)
6. Overwrite local balance with HCM value
7. Return 200 OK to HCM

---

## 7. Edge Cases

**1. HCM is Down**
Problem: Cannot validate balance with source of truth.
Solution:
Default behavior: reject the request to preserve consistency
Optional degraded mode: validate against local cache and mark the request with `validatedLocally: true`
All such requests are flagged and reconciled during the next successful HCM sync

Note: Degraded mode introduces risk of inconsistency and should be used cautiously.

**2. Concurrent Requests (Same Employee)**
Problem: Two requests arrive simultaneously, both read the same balance, both pass validation, both deduct — resulting in negative balance.
Solution: Use a database transaction to ensure atomicity between balance deduction and request creation. Only one request can successfully commit the balance update; subsequent concurrent requests will fail due to insufficient balance after the first commit.

**3. Overlapping Dates**
Problem: Employee has an existing APPROVED or PENDING request for Apr 25–27 and submits a new request for Apr 26–28.
Solution: Before saving, query DB for any existing APPROVED or PENDING requests for that employee where date ranges overlap. If found, reject with 400.

**4. HCM Changes Balance Independently**
Problem: HCM adds bonus days (anniversary, year refresh) without notifying us. Local cache becomes stale.
Solution: Every leave request always validates against HCM in real time. Periodic batch sync overwrites local cache with HCM values. HCM is always the authority — we don't fight it.

**5. Duplicate Requests (Idempotency)**
Problem: The same request may be submitted multiple times due to network retries or client errors.
Solution: Each request includes a unique idempotency key. If a request with the same key has already been processed, the system returns the previous result instead of creating a duplicate.

Note: Not implemented in this version. Marked as a known improvement for production hardening.

---

## 8. Security

**Input Validation:** DTOs with class-validator in NestJS ensure only well-formed, expected data reaches the service layer. Prevents malformed or malicious payloads from propagating to HCM or the DB.

**Authentication:** Mock user identity via request headers. Establishes who is making each request — required for auditing (who submitted, who approved) and for scoping data access per employee.

**Rate Limiting:** Prevents request spam that could degrade system performance or be used as a vector for DoS attacks against both the microservice and HCM downstream.

---

## 9. Testing Strategy

**Happy Path**

- ✅ Valid request, sufficient balance → returns `APPROVED`
- ✅ Batch sync from HCM → local balance updated → returns 200

**Failure Cases**

- ❌ Insufficient balance → returns 400 rejection
- ❌ Invalid dates (past date, end before start) → returns 400 rejection
- ❌ Overlapping dates with existing request → returns 400 rejection

**Edge Cases**

- ⚠️ HCM down → falls back to local cache → returns `APPROVED` with `validatedLocally: true` flag
- ⚠️ Concurrent requests same employee, same days → transaction ensures first succeeds, second returns 400
- ⚠️ HCM batch sync overwrites local balance → difference is logged in audit trail

---

## 10. Alternatives Considered

**1. Local balance as validation guard vs always calling HCM**
We always call HCM for balance validation instead of checking local cache first. The alternative (local-first validation) risks rejecting valid requests — HCM may have added balance since our last sync (anniversary bonus, year refresh). Local cache is for reads and display only, never for gatekeeping writes.

**2. Optimistic vs Pessimistic locking for concurrent requests**
We use optimistic approach — validate then write inside a transaction, letting the DB reject the second write if balance is insufficient. Pessimistic locking (locking the row before reading) would block every request waiting for the lock to release, degrading performance for a race condition that is rare in practice. Optimistic is faster and sufficient here.

**3. SQLite vs Postgres/MySQL**
SQLite was specified for this assessment and is appropriate — it requires zero infrastructure setup, making the project portable and easy to run locally. For a production system at scale, Postgres would be the better choice due to concurrent write handling and connection pooling.
