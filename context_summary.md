# Kanban Task Board - Project Context Summary

**Last Updated:** 2026-05-13  
**Project Status:** v1.2 — Azure migration complete (code), pending first deploy

## Project Overview

A personal Kanban-style task management board for solo use. React frontend + Node.js/Express backend. Originally ran entirely on localhost with local JSON files; now updated to use Azure Blob Storage for persistence and Azure Key Vault for credential management. Targeting Azure App Service for hosting.

**Owner:** Seth Parker  
**Current Users:** 1 (solo use)  
**Backup:** `Kanban Project-backup-2026-05-13-*.zip` in `_Personal` folder

## Current Architecture

### Tech Stack
- **Frontend:** React 18 + Vite (HMR enabled)
- **Backend:** Node.js + Express
- **Storage:** Azure Blob Storage (container: `seth-kanban`)
- **Secrets:** Azure Key Vault (`kvsethkanban`) — secret name: `storage-connection-string`
- **Auth:** DefaultAzureCredential (Managed Identity on App Service, CLI auth locally)
- **Hosting:** Azure App Service (not yet created as of last session)
- **Styling:** Plain CSS (supports dark/light mode)
- **Drag-Drop:** @hello-pangea/dnd

### File Structure
```
backend/
├── server.js (Express API — async, uses Azure Blob Storage)
├── package.json (includes @azure/storage-blob, @azure/identity, @azure/keyvault-secrets, dotenv)
├── .env.example (documents required env vars)
├── .gitignore
└── data/ (legacy local JSON — no longer used in production)
frontend/
├── src/
│   ├── App.jsx (main + tab navigation)
│   ├── api.js (uses relative /api base URL)
│   ├── components/
│   │   ├── Board.jsx
│   │   ├── Column.jsx
│   │   ├── TaskCard.jsx
│   │   ├── AddTaskModal.jsx
│   │   ├── EditTaskModal.jsx
│   │   ├── CompletedView.jsx
│   │   ├── ArchivedView.jsx
│   │   ├── SettingsView.jsx
│   │   └── MoveTasksModal.jsx
│   ├── index.css (all styles)
│   └── main.jsx
├── vite.config.js (proxies /api to localhost:5000 for local dev)
└── package.json
deploy.ps1 (build frontend + zip-deploy to App Service)
```

## Features (v1.2 - Current)

All v1.1 features plus:

✅ **Azure Blob Storage backend**
- tasks.json, completed.json, archived.json, settings.json stored as blobs
- Connection string fetched from Key Vault at startup (never in code)

✅ **Azure Key Vault integration**
- Secret name: `storage-connection-string`
- App authenticates via DefaultAzureCredential (Managed Identity in Azure)

✅ **Production-ready Express server**
- Serves built React frontend from `backend/public/`
- Single URL, single deployment
- PORT from environment variable (App Service injects this)

### v1.1 Features (unchanged)
- Dynamic columns (configurable in Settings)
- Drag-and-drop between columns
- Add/Edit/Delete tasks with confirmation
- Task fields: Title, Description, Customer, DevOps Task #
- Completed & Archived tabs (permanent history)
- 7-day filter on Board display for Completed/Archive columns
- Dark/light mode toggle
- Board name customization
- Column colors, rename, reorder, add/remove with task migration

## Azure Resources

| Resource | Name | Notes |
|----------|------|-------|
| Key Vault | `kvsethkanban` | Secret: `storage-connection-string` |
| Storage Container | `seth-kanban` | Blob storage for all JSON data |
| App Service | Not yet created | Target: Central US, Node 24 LTS, B1 tier |
| Resource Group | TBD | Existing RG, Central US region |

## Azure Setup Remaining (as of last session)

1. **Create App Service** (Central US, Node 24 LTS, B1, Linux)
2. **Enable System-assigned Managed Identity** on App Service
3. **Grant Key Vault access**: Key Vault → Access policies → Get + List secrets → App Service identity
4. **Set App Settings**: `AZURE_KEYVAULT_URL`, `AZURE_STORAGE_CONTAINER_NAME`, `NODE_ENV`
5. **Set up GitHub repo + continuous deployment** via Azure Deployment Center
6. **First deploy** — verify app loads and data persists to blob storage
7. **Custom domain** (optional, discussed — Azure App Service Domains or external registrar)

## Local Development

For local dev after the Azure migration:
1. Run `az login`
2. Create `backend/.env` (git-ignored) with:
   ```
   AZURE_KEYVAULT_URL=https://kvsethkanban.vault.azure.net/
   AZURE_STORAGE_CONTAINER_NAME=seth-kanban
   ```
3. `cd backend && npm start` (port 5000)
4. `cd frontend && npm run dev` (port 3000, proxies /api to 5000)

## Data Model (unchanged from v1.1)

All four JSON files stored as blobs in `seth-kanban` container:
- `tasks.json` — active tasks `{ tasks: [...], columns: [...] }`
- `completed.json` — permanent completed history (array)
- `archived.json` — permanent archived history (array)
- `settings.json` — user preferences and column config

## API Endpoints (unchanged from v1.1)

- `GET/PUT /api/settings`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/completed?startDate=&endDate=`
- `GET /api/archived?startDate=&endDate=`

## Known Issues / Notes

- `deploy.ps1` zips `backend/*` including `node_modules` — works but is large. CI/CD via GitHub Actions is cleaner (installs dependencies server-side).
- VS Code was hanging during GitHub publish — restart resolved it (last session ended here).
- @hello-pangea/dnd warns about nested scroll containers (cosmetic, dev-only)

## Future Enhancements

1. **Custom domain** — buy via Azure App Service Domains or external registrar, free SSL from Azure
2. **Recurring tasks**
3. **Subtasks**
4. **Reports/Analytics**
5. **Mobile app**
