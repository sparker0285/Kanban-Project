# Kanban Task Board - Project Context Summary

**Last Updated:** 2026-05-13  
**Project Status:** v1.1 Released (active development paused, pending user feedback)

## Project Overview

A local Kanban-style task management board for personal use. Simple, functional prototype running on Windows work PC with React frontend and Node.js/Express backend. Data persists locally in JSON files.

**Owner:** Seth Parker  
**Current Users:** 1 (solo use)  
**Future:** Migrate to Azure Storage for backup/sync

## Current Architecture

### Tech Stack
- **Frontend:** React 18 + Vite (HMR enabled)
- **Backend:** Node.js + Express (localhost:5000)
- **Database:** JSON files (tasks.json, completed.json, archived.json, settings.json)
- **Styling:** Plain CSS (supports dark/light mode)
- **Drag-Drop:** @hello-pangea/dnd

### File Structure
```
backend/
├── server.js (Express API)
├── data/
│   ├── tasks.json (active tasks)
│   ├── completed.json (permanent completed history)
│   ├── archived.json (permanent archived history)
│   └── settings.json (user preferences)
frontend/
├── src/
│   ├── App.jsx (main + tab navigation)
│   ├── api.js (API client)
│   ├── components/
│   │   ├── Board.jsx (kanban board)
│   │   ├── Column.jsx (droppable column)
│   │   ├── TaskCard.jsx (draggable task)
│   │   ├── AddTaskModal.jsx
│   │   ├── EditTaskModal.jsx
│   │   ├── CompletedView.jsx
│   │   ├── ArchivedView.jsx (NEW)
│   │   └── SettingsView.jsx (NEW)
│   ├── index.css (all styles)
│   └── main.jsx
```

## Features (v1.1 - Current)

✅ **Board Tab**
- Dynamic columns (configurable in Settings, min 2: one active + Completed)
- Drag-and-drop between columns
- Add/Edit/Delete tasks
- Task timestamps (created, completed/archived)
- DevOps Task # displays as `#1234 - Task Title` if filled
- Customer name displayed on cards
- Completed & Archive columns: show only last 7 days + date badge

✅ **Task Management**
- Title, Description, Customer, DevOps Task #
- All fields editable in Add & Edit modals
- Column selection in Edit modal

✅ **Completed Tab**
- Permanent history of all completed tasks
- Date range filters (Last 7 days, Last 30 days, All)
- Expandable task details (description, customer, DevOps Task #, timestamps)
- Real-time search (title + description + customer)
- Sorted by completion date (newest first)

✅ **Archived Tab**
- Permanent history of all archived tasks
- Same filtering, search, and display as Completed tab
- Separate column from Completed for organizational clarity

✅ **Settings Tab**
- **Dark Mode**: Toggle dark/light theme (persists to settings.json)
- **Board Name**: Customize "Kanban Task Board" title
- **Column Management**:
  - View all columns with their colors
  - Add new columns (auto-assigns unused color from 15-color palette)
  - Remove columns (Completed column cannot be removed, mandatory)
  - Rename columns (including Completed column)
  - All colors customizable via color picker
  - Max ~15 columns (palette limit)
- **Settings persist** to backend

✅ **Dark Mode**
- Applied globally to all UI (light mode also available)
- Default: dark mode enabled
- Toggle in Settings tab

## Key Implementation Details

### 7-Day Filter Logic (Board Tab)
- **Completed** and **Archive** columns on Board tab only display tasks completed/archived in last 7 days
- Historical data remains in completed.json and archived.json (accessible via Completed/Archived tabs)
- Completed & Archive cards show date badge (e.g., "May 13")
- Tasks sorted by completion/archive date (newest first)
- Prevents clutter on board while preserving full history

### Column Management
- Columns are user-customizable (add/remove/rename/recolor)
- Default columns: Priority, Backlog, Archive, Completed
- "Completed" column is mandatory (required for the Completed tab to function)
- Column order is preserved as configured in settings.json
- Each column has a dedicated color (supports 15 max via color palette)

## Data Model (v1.1)

### tasks.json (Active Tasks)
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task name",
      "description": "Optional details",
      "customer": "Customer name",
      "devopsTaskNum": null,
      "column": "Priority",
      "createdAt": "2026-05-13T12:00:00.000Z",
      "completedAt": null,
      "archivedAt": null
    }
  ],
  "columns": ["Priority", "Backlog", "Archive", "Completed"]
}
```

**Note:** `completedAt` is auto-set when task moves to Completed column. `archivedAt` is auto-set when task moves to Archive column.

### completed.json (Completed Tasks History)
Array of all tasks ever moved to Completed column. Same schema as tasks.json, but `completedAt` is always populated.

### archived.json (Archived Tasks History)
Array of all tasks ever moved to Archive column. Same schema as tasks.json, but `archivedAt` is always populated.

### settings.json (User Preferences & Configuration)
```json
{
  "boardName": "Kanban Task Board",
  "darkMode": true,
  "columns": ["Priority", "Backlog", "Archive", "Completed"],
  "columnColors": {
    "Priority": "#ef4444",
    "Backlog": "#3b82f6",
    "Archive": "#f59e0b",
    "Completed": "#22c55e"
  },
  "columnDisplayNames": {
    "Completed": "Completed"
  }
}
```

**Key fields:**
- `boardName`: Displayed in app header, customizable via Settings
- `darkMode`: Boolean, toggle in Settings tab
- `columns`: Array of configured column names (ordered, user can add/remove)
- `columnColors`: Map of column name → hex color
- `columnDisplayNames`: Map for column aliases (e.g., show "Done" but use "Completed" internally)

## API Endpoints

### Tasks (Active)
- `GET /api/tasks` → `{ tasks: [...], columns: [...] }`
- `POST /api/tasks` → create task (auto-sets `createdAt`, `completedAt`/`archivedAt` if column is Completed/Archive)
  - Body: `{ title, description?, customer?, devopsTaskNum?, column? }`
- `PUT /api/tasks/:id` → update task (auto-manages timestamps based on column changes)
  - Body: any task fields to update
- `DELETE /api/tasks/:id` → delete task from active list

### Completed Tasks (History)
- `GET /api/completed?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` → filter by completion date
  - Returns tasks sorted by `completedAt` (newest first)

### Archived Tasks (History)
- `GET /api/archived?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` → filter by archive date
  - Returns tasks sorted by `archivedAt` (newest first)

### Settings
- `GET /api/settings` → return full settings object
- `PUT /api/settings` → update settings
  - Body: any settings fields to update (partial update OK)

## Application Tabs

The app has 4 main views (tabs in header):

1. **Board** - Main Kanban interface with drag-drop columns
2. **Completed** - History of all completed tasks (permanent record, not deleted)
3. **Archived** - History of all archived tasks (permanent record, not deleted)
4. **Settings** - User preferences, board config, column management

## Known Issues / Tech Debt

- @hello-pangea/dnd warns about nested scroll containers (cosmetic, dev-only)
- JSON file I/O is synchronous (OK for small data, consider async later)
- No conflict resolution if multiple tabs/devices edit same task (solo use for now)

## Future Enhancements

1. **Azure Storage migration**
   - Backup tasks.json, completed.json, archived.json to Azure Blob Storage
   - Settings to cloud too

2. **Recurring tasks**
   - Template tasks that recreate on schedule

3. **Subtasks**
   - Hierarchical task structure

4. **Reports/Analytics**
   - Velocity charts, completion trends

5. **Mobile app**
   - React Native or PWA version

## Running the App

```bash
# Terminal 1: Backend
cd backend
npm install
npm start         # or: node server.js

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

**Access:** http://localhost:3001 (or next available port if 3001 is in use)

### Available npm Scripts

**Backend:**
- `npm start` — Start Express server (production)

**Frontend:**
- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Build for production
- `npm run preview` — Preview production build locally

## Notes for Claude

### Code Style & Preferences
- **User preference**: Clean, functional UI over fancy animations
- **Code quality > complexity** — no over-engineering or premature abstractions
- **Follow existing patterns** — maintain consistency with established component structure
- **Keep components focused** — single responsibility principle
- **All timestamps in local timezone** — handled via JavaScript Date methods

### Architecture Notes
- Single-user app — no multi-user conflict resolution or auth needed
- Direct file I/O OK for now (JSON in /backend/data/) — will migrate to Azure later
- Component state is ephemeral — settings and historical data come from backend
- Hot reload enabled on frontend via Vite (great for development)
- Settings are user-configurable and persist across sessions

### Future Work Priorities
1. **Azure Storage integration** — migrate tasks.json, completed.json, archived.json, settings.json to Azure Blob/Table Storage
2. **Additional task fields** — user may want to add labels, due dates, priorities, attachments
3. **Bulk operations** — move multiple tasks, archive old items, export data
4. **Search improvements** — filters, sort by date/customer, saved searches

### Testing the App
- Always test both dark and light modes
- Verify timestamps display in local timezone (important!)
- Check that 7-day filter works correctly (oldest items drop off board after 7 days)
- Confirm settings persist after page refresh
- Verify Completed/Archived tabs show full history (not just last 7 days)
