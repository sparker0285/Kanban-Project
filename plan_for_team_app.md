# Team Multi-User Expansion — Implementation Plan

**Status:** Pending leadership approval  
**Drafted:** 2026-05-27  
**Target team size:** 5–7 people (scalable to 30+ with Cosmos DB migration, see Phase 5)

---

## Vision

Expand the personal Kanban board into a shared team tool while keeping the personal board experience completely intact. Each user has their own private board plus access to a shared Team Backlog and a read-only Team View of everyone's active work.

---

## Core Principles

- A task exists in **exactly one place** at all times
- Personal board behavior is **unchanged** — existing users lose nothing
- Authentication via **Azure Entra ID** — SSO with existing Microsoft org accounts
- No new database required for 5–7 users — extends existing blob storage pattern
- Backend data access wrapped in a **service layer** from the start for future Cosmos DB migration

---

## Task Lifecycle

```
Team Backlog  ←──────────────────────────────────────────┐
     │                                                    │
     │  claim (atomic move)          hand back (atomic move)
     ▼                                                    │
Personal Board  ──────────────────────────────────────────┘
     │
     │  complete / archive
     ▼
Completed / Archive (personal history, never shared)
```

---

## Data Storage

### Blob Structure (extends current layout)

```
shared/
  tasks.json          ← Team Backlog tasks (unowned)
  config.json         ← team member list, colors, admin IDs

<entraObjectId>/
  tasks.json          ← personal active tasks (current: tasks.json)
  completed.json      ← personal history
  archived.json       ← personal history
  settings.json       ← personal board preferences
```

### shared/config.json Schema

```json
{
  "admins": ["<entra-object-id>"],
  "members": [
    {
      "id": "<entra-object-id>",
      "name": "Seth Parker",
      "email": "sparker@quicklaunchanalytics.com",
      "color": "#3b82f6"
    }
  ]
}
```

Managed directly (no admin UI required initially). Admins add/remove members by editing this file.

### Team Task Schema (shared/tasks.json)

Same schema as personal tasks, with two additional fields:

```json
{
  "id": "uuid",
  "title": "Task name",
  "description": "Optional details",
  "customer": "Project/Customer name",
  "devopsTaskNum": null,
  "devopsItemUrl": null,
  "column": "Team Backlog",
  "createdAt": "2026-05-27T...",
  "createdBy": "<entra-object-id>",
  "createdByName": "Seth Parker"
}
```

---

## Roles & Permissions

| Action | Normal User | Admin |
|--------|-------------|-------|
| View team backlog | ✅ | ✅ |
| Add task to team backlog | ✅ | ✅ |
| Claim a team backlog task | ✅ | ✅ |
| Hand personal task back to team | ✅ | ✅ |
| Edit/delete own personal tasks | ✅ | ✅ |
| Edit/delete any task (personal or shared) | ❌ | ✅ |
| Manage team member list | ❌ | ✅ |

Admin list is defined in `shared/config.json`. Checked server-side on every write request.

---

## UI Changes

### New Tabs

| Tab | Description |
|-----|-------------|
| **Board** | Personal board — completely unchanged |
| **Team Backlog** (new) | Shared task pool. Add tasks, claim them (moves to your Priority or Backlog), hand back personal tasks. |
| **Team View** (new) | Read-only. Shows Priority + Backlog tasks for all team members, color-coded by person. |
| **DevOps Staging** | Personal view unchanged. Add toggle: "Team View" shows all members' assigned DevOps items. |
| **Completed / Archived** | Personal history — unchanged |
| **Settings** | Personal settings — unchanged |

### Team Backlog Tab

- Task cards show `createdBy` name/color chip
- "Claim to Priority" / "Claim to Backlog" buttons (mirrors DevOps Staging import buttons)
- "+ Add Team Task" button (same modal as Add Task, no column selector)
- Admins see edit/delete on all cards; normal users see no edit controls on others' cards
- Personal tasks have a "Hand back to Team" option in the Task Detail modal

### Team View Tab

- Read-only grid — one column per team member
- Each column shows that person's Priority + Backlog tasks
- Task cards are color-coded with a left border matching the member's color from config
- No drag-drop, no edit controls (Admin edit not exposed here — use Board for that)
- Refreshes on tab load (no caching needed — small dataset)

### Task Detail Modal (personal board)

Add a "Hand back to Team" button. Only visible on personal tasks (not completed/archived). Confirms before moving.

---

## Backend Changes

### Phase 1: Authentication Middleware

**New dependency:** `jwks-rsa`, `jsonwebtoken`

```
backend/
  middleware/
    auth.js          ← JWT verification, extracts userId + isAdmin
```

- Verify Entra ID JWT on every `/api/*` request
- Attach `req.user = { id, name, email, isAdmin }` to request
- Return 401 if token missing/invalid
- Register app in Azure Entra ID (admin task, one-time portal config)

### Phase 2: Service Layer

**New file:** `backend/storage.js`

Wraps all blob reads/writes. Replaces direct `readBlob`/`writeBlob` calls in server.js.

```javascript
// Personal
getUserTasks(userId)
setUserTasks(userId, tasks)
getUserCompleted(userId)
getUserArchived(userId)
getUserSettings(userId)
setUserSettings(userId, settings)

// Shared
getTeamTasks()
setTeamTasks(tasks)
getTeamConfig()

// Atomic operations
claimTask(userId, taskId, targetColumn)    // shared → personal
handBackTask(userId, taskId)               // personal → shared
```

This layer is where a Cosmos DB swap would happen in the future — endpoints don't change.

### Phase 3: Data Migration

On first authenticated load, if `<userId>/tasks.json` doesn't exist but the root `tasks.json` does (legacy solo-user data), auto-migrate:

- Copy `tasks.json` → `<userId>/tasks.json`
- Copy `completed.json` → `<userId>/completed.json`
- Copy `archived.json` → `<userId>/archived.json`
- Copy `settings.json` → `<userId>/settings.json`

One-time, non-destructive (keeps root files as backup).

### Phase 4: New API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/team/tasks` | Any member | Team backlog tasks |
| POST | `/api/team/tasks` | Any member | Add task to team backlog |
| PUT | `/api/team/tasks/:id` | Admin only | Edit a team task |
| DELETE | `/api/team/tasks/:id` | Admin only | Delete a team task |
| POST | `/api/team/tasks/:id/claim` | Any member | Atomic: shared → personal |
| POST | `/api/tasks/:id/handback` | Task owner or Admin | Atomic: personal → shared |
| GET | `/api/team/view` | Any member | Aggregated Priority+Backlog for all members |
| GET | `/api/team/config` | Any member | Member list + colors |
| GET | `/api/devops/tasks?team=true` | Any member | DevOps items for all team members |

Existing personal endpoints (`/api/tasks`, `/api/completed`, etc.) remain unchanged — just add `userId` extraction from JWT to scope reads/writes to the authenticated user.

### DevOps Endpoint Changes

- Replace hardcoded `sparker@quicklaunchanalytics.com` with `req.user.email`
- Add `?team=true` param: queries DevOps for all emails in `shared/config.json members`
- Team DevOps view groups results by assignee

---

## Frontend Changes

### New Dependencies

- `@azure/msal-browser` — MSAL authentication library
- `@azure/msal-react` — React wrapper

### New Files

```
frontend/src/
  auth/
    msalConfig.js          ← Entra app client ID, tenant ID, scopes
    AuthProvider.jsx        ← Wraps app in MsalProvider
  components/
    TeamBacklogView.jsx     ← Team backlog tab
    TeamView.jsx            ← Read-only team aggregation tab
    LoginPage.jsx           ← Shown before auth completes
```

### Modified Files

```
frontend/src/
  App.jsx                  ← Add auth wrapper, new tabs, user context
  api.js                   ← Add Bearer token to all requests
  components/
    TaskDetailModal.jsx     ← Add "Hand back to Team" button
```

### Auth Flow

```
App loads → MSAL checks for existing session
  → Session exists: load app normally
  → No session: show LoginPage with "Sign in with Microsoft" button
  → After login: MSAL returns token, stored in memory (not localStorage)
  → All API calls attach: Authorization: Bearer <token>
```

---

## Azure Configuration (One-Time Setup)

1. **Register app in Entra ID** (Azure Portal → App Registrations)
   - Set redirect URI to `https://kanban.sethsapps.com`
   - Enable implicit grant / auth code flow
   - Note: Client ID, Tenant ID

2. **Add environment variables to App Service:**
   - `ENTRA_TENANT_ID`
   - `ENTRA_CLIENT_ID`
   - `ENTRA_AUDIENCE` (usually same as client ID)

3. **Add frontend env vars** (Vite build):
   - `VITE_ENTRA_CLIENT_ID`
   - `VITE_ENTRA_TENANT_ID`

4. **Grant Storage access** — no change needed (Managed Identity already handles this)

5. **Bump App Service plan** — B1 → B2 recommended for multi-user load (optional, monitor first)

---

## Implementation Phases & Effort

| Phase | Work | Estimated Effort |
|-------|------|-----------------|
| 1 | Entra app registration + MSAL login flow + JWT middleware | 1 day |
| 2 | Service layer + per-user blob namespacing + data migration | 0.5 day |
| 3 | Team Backlog backend endpoints + Team Backlog UI tab | 1 day |
| 4 | Team View backend aggregation + Team View UI tab | 0.5 day |
| 5 | Hand back / claim UI wiring + Task Detail modal update | 0.5 day |
| 6 | DevOps team view toggle | 0.5 day |
| 7 | Testing, polish, deploy | 0.5 day |
| **Total** | | **~4.5 days** |

---

## Scaling to 30+ Users (Future Phase)

The service layer (`storage.js`) is designed so that swapping blob storage for **Azure Cosmos DB (serverless tier)** is a contained change:

**Why Cosmos DB at 30+ users:**
- Concurrent write safety (blob JSON has race conditions at scale)
- Team view becomes a single indexed query instead of 30 parallel blob reads
- Admin management queries (find tasks by user, date, etc.)
- Negligible cost at this usage level (serverless billing)

**Migration scope when the time comes:**
- Rewrite functions in `storage.js` to use Cosmos SDK instead of blob SDK
- One-time data migration script (JSON → Cosmos documents, same schema)
- No changes to API endpoints, frontend, or auth

**No other architectural changes needed** — the rest of the design already supports 30+ users.

---

## Testing Checklist

- [ ] Login with Microsoft redirects correctly and returns to app
- [ ] Unauthenticated requests return 401
- [ ] Personal board loads scoped to logged-in user only
- [ ] Existing solo-user data migrates correctly on first login
- [ ] Add task to team backlog — appears for all logged-in users
- [ ] Claim task — removed from team backlog, appears on personal board
- [ ] Hand back task — removed from personal board, appears in team backlog
- [ ] Team View shows correct tasks per member, color-coded correctly
- [ ] Admin can edit/delete any task; normal user cannot edit others' tasks
- [ ] DevOps personal view shows only logged-in user's items
- [ ] DevOps team toggle shows all members' items grouped by assignee
- [ ] Dark/light mode works on all new tabs
- [ ] Deploy to Azure — verify Managed Identity still works post-auth addition
