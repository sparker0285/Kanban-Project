# Kanban Task Board - Project Context Summary

**Last Updated:** 2026-05-14  
**Project Status:** v1.2 — Live on Azure with custom domain

## Project Overview

A personal Kanban-style task management board running on Azure. React frontend + Node.js/Express backend with Azure Blob Storage persistence. Deployed to production with custom domain (kanban.sethsapps.com).

**Owner:** Seth Parker  
**Current Users:** 1 (solo use)  
**Domain:** kanban.sethsapps.com  
**Backup:** `Kanban Project-backup-2026-05-13-*.zip` in `_Personal` folder

## Current Architecture

### Tech Stack
- **Frontend:** React 18 + Vite (HMR enabled)
- **Backend:** Node.js + Express (Azure App Service)
- **Storage:** Azure Blob Storage (container: `seth-kanban`)
- **Auth:** Managed Identity (no credentials in code)
- **Hosting:** Azure App Service (B1 tier, Central US)
- **Domain:** Custom domain via Namecheap DNS
- **Styling:** Plain CSS (supports dark/light mode)
- **Drag-Drop:** @hello-pangea/dnd

### File Structure
```
backend/
├── server.js (Express API — async, uses Azure Blob Storage with Managed Identity)
├── package.json (includes @azure/storage-blob, @azure/identity, dotenv)
├── .env.example (documents required env vars)
├── .gitignore
└── data/ (legacy local JSON — no longer used)
frontend/
├── src/
│   ├── App.jsx (main + tab navigation, dynamic page title)
│   ├── api.js (uses relative /api base URL)
│   ├── components/
│   │   ├── Board.jsx (immediate UI updates on drag-drop)
│   │   ├── Column.jsx
│   │   ├── TaskCard.jsx
│   │   ├── AddTaskModal.jsx (Project/Customer field)
│   │   ├── EditTaskModal.jsx (Project/Customer field)
│   │   ├── CompletedView.jsx
│   │   ├── ArchivedView.jsx
│   │   ├── SettingsView.jsx (Archive column protected)
│   │   └── MoveTasksModal.jsx
│   ├── index.css (all styles)
│   ├── index.html (favicon.ico, page title)
│   └── main.jsx
├── vite.config.js (proxies /api to localhost:5000 for local dev)
└── package.json
deploy.ps1 (build frontend + zip-deploy to App Service)
.github/workflows/azure-deploy.yml (GitHub Actions CI/CD)
```

## Features (v1.2 - Current)

✅ **Live on Azure**
- Deployed to Azure App Service (B1, Central US)
- Custom domain: kanban.sethsapps.com
- HTTPS enabled (free managed certificate)
- GitHub Actions CI/CD pipeline

✅ **Managed Identity Authentication**
- No secrets in code or environment
- App Service → Azure Storage via Managed Identity
- Storage Blob Data Contributor role

✅ **Board Tab**
- Dynamic columns (configurable in Settings)
- Drag-and-drop between columns (immediate UI update with completedAt/archivedAt)
- Add/Edit/Delete tasks
- Task fields: Title, Description, Project/Customer, DevOps Task #
- Completed & Archive columns: 7-day filter + date badge
- Archive column protected from deletion

✅ **Task Management**
- All fields editable in Add & Edit modals
- Column selection in Edit modal
- Timestamps: createdAt, completedAt, archivedAt

✅ **Completed Tab**
- Permanent history (all completed tasks)
- Date range filters (Last 7 days, Last 30 days, All)
- Expandable task details
- Real-time search

✅ **Archived Tab**
- Permanent history (all archived tasks)
- Same filtering/search as Completed tab
- Archive column protected from deletion

✅ **Settings Tab**
- Dark/Light mode toggle
- Board name customization (reflected in browser tab title)
- Column management: add, remove (with task migration), rename, reorder, color
- Completed and Archive columns cannot be deleted

✅ **UI/UX**
- Dark mode CSS variables (all text readable)
- Browser tab title matches board name (dynamic)
- Favicon customizable (favicon.ico)
- Responsive layout
- Clean, functional design

## Azure Resources

| Resource | Name | Details |
|----------|------|---------|
| App Service | seth-kanban-app-a9a7a8gzahc0dzbt | B1 tier, Node 24 LTS, Central US |
| Storage Account | sethappstorage | Blob storage, seth-kanban container |
| Custom Domain | kanban.sethsapps.com | Via Namecheap DNS (CNAME + TXT) |
| App Service Plan | kanban-plan | B1 Linux, Central US |

## Data Model (v1.2)

### tasks.json (Active Tasks)
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task name",
      "description": "Optional details",
      "customer": "Project/Customer name",
      "devopsTaskNum": null,
      "column": "Priority",
      "createdAt": "2026-05-14T...",
      "completedAt": null,
      "archivedAt": null
    }
  ]
}
```

### completed.json & archived.json
Arrays of historical tasks with timestamps populated.

### settings.json
```json
{
  "boardName": "Seth's Task Board",
  "darkMode": true,
  "columns": ["Priority", "Backlog", "Archive", "Completed"],
  "columnColors": { ... },
  "columnDisplayNames": { ... }
}
```

## API Endpoints

- `GET/PUT /api/settings`
- `GET /api/tasks` → `[{task}]`
- `POST /api/tasks` → create (auto-sets createdAt, completedAt if Completed)
- `PUT /api/tasks/:id` → update (auto-manages timestamps on column change)
- `DELETE /api/tasks/:id`
- `GET /api/completed?startDate=X&endDate=Y` → sorted by completedAt
- `GET /api/archived?startDate=X&endDate=Y` → sorted by archivedAt

## Deployment Pipeline

**GitHub Actions** (`azure-deploy.yml`):
1. Build React frontend (`npm run build`)
2. Copy build output to `backend/public/`
3. Install backend dependencies
4. Zip and deploy to Azure App Service

**Trigger:** Any push to `main` branch

## Known Issues & Notes

- @hello-pangea/dnd warns about nested scroll (cosmetic, dev-only)
- Drag-drop now sets completedAt/archivedAt on frontend for instant UI (no tab-switching needed)
- JSON file I/O is synchronous on backend (acceptable for small data)
- No multi-user conflict resolution (solo use)

## Future Enhancement Ideas

1. **Azure DevOps Integration** (planned, not started)
   - Fetch work items assigned to user from Azure DevOps
   - One-way or two-way sync
   - Requires: azure-devops-node-api, PAT auth, REST API integration

2. **Recurring tasks** — templates that auto-recreate
3. **Subtasks** — hierarchical task structure
4. **Reports/Analytics** — velocity, completion trends
5. **Mobile app** — React Native or PWA
6. **Additional subdomains** — bggapp.sethsapps.com, etc.
7. **Search improvements** — filters, sort options, saved searches

## Running the App

### Production
- **Access:** https://kanban.sethsapps.com
- **Hosting:** Azure App Service B1 (always on, auto-scaled)
- **Deployment:** GitHub Actions CI/CD

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm install
npm start         # Listens on port 8080 (or $PORT env var)

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev       # Listens on port 3000, proxies /api to localhost:5000
```

## Notes for Claude

### Code Style
- Clean, functional UI over fancy animations
- Code quality > complexity
- Follow existing patterns
- Single responsibility components
- Timestamps in local timezone

### Architecture
- Solo-user app (no auth/conflict resolution needed)
- Managed Identity for Azure auth (best practice)
- Subdomain strategy for multi-app future (kanban.*, bggapp.*, etc.)
- Modular components, ephemeral frontend state

### Testing
- Always test dark/light modes
- Verify timestamps display correctly
- Check 7-day filter works (oldest items drop off)
- Confirm settings persist across refresh
- Test drag-drop immediate UI update

## Deployment Checklist

- ✅ App Service created (B1, Central US)
- ✅ Managed Identity enabled + granted Storage Blob Data Contributor
- ✅ GitHub Actions CI/CD pipeline working
- ✅ Custom domain configured (kanban.sethsapps.com)
- ✅ HTTPS enabled (free managed certificate)
- ✅ Tasks persist to Azure Blob Storage
- ✅ Settings persist across sessions
- ✅ Drag-drop works with instant UI update
