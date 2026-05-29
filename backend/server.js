require('dotenv').config();

console.log('SERVER STARTING');
console.log('PORT:', process.env.PORT);
console.log('AZURE_STORAGE_ACCOUNT_NAME:', process.env.AZURE_STORAGE_ACCOUNT_NAME);
console.log('AZURE_STORAGE_CONTAINER_NAME:', process.env.AZURE_STORAGE_CONTAINER_NAME);
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const { SecretClient } = require('@azure/keyvault-secrets');

const app = express();
const PORT = process.env.PORT || 5000;
const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'sethappstorage';
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'seth-kanban';

let containerClient;
let devopsUrl;
let devopsPat;
let devopsSecretsLoaded = false;
let devopsSecretsError = null;

// In-memory blob cache — write-through, invalidated on cold start
const blobCache = {};

const DEFAULT_SETTINGS = {
  boardName: 'Kanban Task Board',
  darkMode: true,
  columns: ['Priority', 'Backlog', 'Archive', 'Completed'],
  columnColors: {
    Priority: '#ef4444',
    Backlog: '#3b82f6',
    Archive: '#f59e0b',
    Completed: '#22c55e',
  },
  columnDisplayNames: {
    Completed: 'Completed',
  },
  staleTaskDays: { Priority: 7, Backlog: 30 },
};

async function initDevopsSecrets(credential) {
  const vaultUrl = process.env.AZURE_KEYVAULT_URL;
  if (!vaultUrl) {
    devopsSecretsError = 'AZURE_KEYVAULT_URL not configured';
    console.log(`WARNING: ${devopsSecretsError}`);
    return;
  }

  try {
    const secretClient = new SecretClient(vaultUrl, credential);
    const [urlSecret, patSecret] = await Promise.all([
      secretClient.getSecret('devops-url'),
      secretClient.getSecret('devops-token-qla'),
    ]);
    devopsUrl = urlSecret.value.replace(/\/$/, '');
    devopsPat = patSecret.value;
    devopsSecretsLoaded = true;
    console.log('DevOps secrets loaded from Key Vault');
  } catch (err) {
    devopsSecretsError = err.message;
    console.log(`WARNING: Failed to load DevOps secrets: ${err.message}`);
  }
}

async function initStorage() {
  console.log(`Initializing storage with Managed Identity...`);
  console.log(`Storage account: ${STORAGE_ACCOUNT_NAME}`);
  console.log(`Container: ${CONTAINER_NAME}`);

  try {
    const credential = new DefaultAzureCredential();
    console.log(`DefaultAzureCredential created (using Managed Identity)`);

    const blobServiceUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
    const blobService = new BlobServiceClient(blobServiceUrl, credential);
    console.log(`BlobServiceClient created for ${blobServiceUrl}`);

    containerClient = blobService.getContainerClient(CONTAINER_NAME);
    console.log(`Connected to storage container: ${CONTAINER_NAME}`);

    await initDevopsSecrets(credential);
  } catch (err) {
    console.log(`ERROR during initStorage: ${err.message}`);
    throw err;
  }
}

async function readBlob(blobName, defaultValue) {
  if (blobCache[blobName] !== undefined) return blobCache[blobName];
  try {
    const buf = await containerClient.getBlockBlobClient(blobName).downloadToBuffer();
    const data = JSON.parse(buf.toString());
    blobCache[blobName] = data;
    return data;
  } catch {
    return defaultValue;
  }
}

async function writeBlob(blobName, data) {
  const content = JSON.stringify(data, null, 2);
  await containerClient.getBlockBlobClient(blobName).upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true,
  });
  blobCache[blobName] = data;
}

async function readSettings() {
  return readBlob('settings.json', DEFAULT_SETTINGS);
}

async function writeSettings(data) {
  return writeBlob('settings.json', data);
}

async function readTasks() {
  const data = await readBlob('tasks.json', { tasks: [] });
  const taskList = data.tasks || data;
  console.log(`readTasks: Found ${Array.isArray(taskList) ? taskList.length : 0} tasks`);
  return taskList;
}

async function writeTasks(tasks) {
  console.log(`writeTasks: Writing ${Array.isArray(tasks) ? tasks.length : 0} tasks`);
  const settings = await readSettings();
  await writeBlob('tasks.json', { tasks, columns: settings.columns });
  console.log(`writeTasks: Successfully wrote tasks to blob`);
}

async function readCompleted() {
  return readBlob('completed.json', []);
}

async function writeCompleted(tasks) {
  return writeBlob('completed.json', tasks);
}

async function readArchived() {
  return readBlob('archived.json', []);
}

async function writeArchived(tasks) {
  return writeBlob('archived.json', tasks);
}

function httpsRequest(method, url, body = null, auth = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kanban-App',
      },
    };

    if (auth) {
      options.headers.Authorization = auth;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data || '{}'));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

app.use(cors({ origin: /^http:\/\/localhost/ }));
app.use(express.json());

// Serve built React frontend in production
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/settings
app.get('/api/settings', async (req, res) => {
  try {
    res.json(await readSettings());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

// PUT /api/settings
app.put('/api/settings', async (req, res) => {
  try {
    const settings = await readSettings();
    const updated = { ...settings, ...req.body };
    await writeSettings(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/tasks
app.get('/api/tasks', async (req, res) => {
  try {
    res.json(await readTasks());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

// GET /api/completed?startDate=X&endDate=Y
app.get('/api/completed', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let tasks = await readCompleted();

    if (startDate) {
      const start = new Date(startDate);
      tasks = tasks.filter(t => t.completedAt && new Date(t.completedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      tasks = tasks.filter(t => t.completedAt && new Date(t.completedAt) <= end);
    }

    res.json(tasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read completed tasks' });
  }
});

// GET /api/archived?startDate=X&endDate=Y
app.get('/api/archived', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let tasks = await readArchived();

    if (startDate) {
      const start = new Date(startDate);
      tasks = tasks.filter(t => t.archivedAt && new Date(t.archivedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      tasks = tasks.filter(t => t.archivedAt && new Date(t.archivedAt) <= end);
    }

    res.json(tasks.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read archived tasks' });
  }
});

// POST /api/tasks
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, column, customer, devopsTaskNum, dueDate } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const settings = await readSettings();
    const completedCol = settings.columnDisplayNames?.Completed || 'Completed';

    const tasks = await readTasks();
    const colTasks = tasks.filter(t => t.column === (column || 'Backlog'));
    const maxOrder = colTasks.reduce((max, t) => (t.order != null ? Math.max(max, t.order) : max), -1);

    const task = {
      id: uuidv4(),
      title: title.trim(),
      description: description ? description.trim() : '',
      customer: customer ? customer.trim() : '',
      devopsTaskNum: devopsTaskNum || null,
      column: column || 'Backlog',
      order: maxOrder + 1,
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
      completedAt: column === completedCol ? new Date().toISOString() : null,
      archivedAt: column === 'Archive' ? new Date().toISOString() : null,
    };

    tasks.push(task);
    await writeTasks(tasks);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/reorder — must be declared BEFORE /:id to avoid Express matching "reorder" as an id
app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { reorders } = req.body; // [{ column, taskIds: ['id1','id2',...] }]
    if (!Array.isArray(reorders)) return res.status(400).json({ error: 'reorders must be an array' });

    const tasks = await readTasks();
    reorders.forEach(({ taskIds }) => {
      taskIds.forEach((id, idx) => {
        const task = tasks.find(t => t.id === id);
        if (task) task.order = idx;
      });
    });
    await writeTasks(tasks);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const tasks = await readTasks();
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const settings = await readSettings();
    const completedCol = settings.columnDisplayNames?.Completed || 'Completed';
    const existing = tasks[idx];
    // Strip reorders from the task fields before merging
    const { reorders: inlineReorders, ...taskFields } = req.body;
    const updated = { ...existing, ...taskFields };

    if (updated.column === completedCol && existing.column !== completedCol) {
      updated.completedAt = new Date().toISOString();
    }
    if (updated.column !== completedCol && existing.column === completedCol) {
      updated.completedAt = null;
    }
    if (updated.column === 'Archive' && existing.column !== 'Archive') {
      updated.archivedAt = new Date().toISOString();
    }
    if (updated.column !== 'Archive' && existing.column === 'Archive') {
      updated.archivedAt = null;
    }

    tasks[idx] = updated;

    // Apply inline reorders if provided (batches column-change + reorder into one write)
    if (Array.isArray(inlineReorders)) {
      inlineReorders.forEach(({ taskIds }) => {
        taskIds.forEach((id, i) => {
          const t = tasks.find(t => t.id === id);
          if (t) t.order = i;
        });
      });
    }

    await writeTasks(tasks);

    // Mirror to completed/archived history
    if (updated.column === completedCol && existing.column !== completedCol) {
      const completed = await readCompleted();
      completed.push(updated);
      await writeCompleted(completed);
    }
    if (updated.column === 'Archive' && existing.column !== 'Archive') {
      const archived = await readArchived();
      archived.push(updated);
      await writeArchived(archived);
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const tasks = await readTasks();
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    tasks.splice(idx, 1);
    await writeTasks(tasks);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET /api/devops/tasks
app.get('/api/devops/tasks', async (req, res) => {
  try {
    if (!devopsSecretsLoaded) {
      const message = devopsSecretsError || 'DevOps integration not configured';
      return res.status(503).json({
        error: message,
        details: 'Check Key Vault access and AZURE_KEYVAULT_URL environment variable'
      });
    }

    const tasks = await readTasks();
    // Map devopsTaskNum → column for active board tasks only (completed/archived don't show on staging)
    const importedColumnMap = {};
    tasks.filter(t => t.devopsTaskNum).forEach(t => {
      importedColumnMap[t.devopsTaskNum] = t.column;
    });

    const allItems = [];
    const auth = 'Basic ' + Buffer.from(`:${devopsPat}`).toString('base64');

    // Fetch all projects from the organization
    let projects = [];
    try {
      const projectsUrl = `${devopsUrl}/_apis/projects?api-version=7.1`;
      const projectsResult = await httpsRequest('GET', projectsUrl, null, auth);
      projects = (projectsResult.value || []).map(p => p.name);
      console.log('DevOps: Fetching from all projects:', JSON.stringify(projects));
    } catch (err) {
      console.error('Failed to fetch projects:', err.message);
      return res.status(500).json({ error: 'Failed to fetch projects from Azure DevOps' });
    }
    let authError = null;
    for (const project of projects) {
      try {
        const wiqlUrl = `${devopsUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`;
        const wiqlBody = {
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN ('Task','Bug') AND [System.AssignedTo] = 'sparker@quicklaunchanalytics.com' AND [System.State] NOT IN ('Closed','Removed')`,
        };

        const wiqlResult = await httpsRequest('POST', wiqlUrl, wiqlBody, auth);
        const workItemIds = wiqlResult.workItems?.map(wi => wi.id) || [];

        if (!workItemIds.length) continue;

        const batchUrl = `${devopsUrl}/_apis/wit/workitems?ids=${workItemIds.join(',')}&fields=System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,System.Description,System.TeamProject,System.IterationPath&api-version=7.1`;
        const batchResult = await httpsRequest('GET', batchUrl, null, auth);

        const items = (batchResult.value || [])
          .map(wi => {
            const assignedTo = wi.fields['System.AssignedTo'];
            const assignedToName = typeof assignedTo === 'object' ? (assignedTo.displayName || assignedTo.uniqueName) : assignedTo;
            const iterationPath = wi.fields['System.IterationPath'] || '';
            const iteration = iterationPath.split('\\').pop() || '(No Iteration)';
            return {
              id: wi.id,
              title: wi.fields['System.Title'],
              state: wi.fields['System.State'],
              type: wi.fields['System.WorkItemType'],
              assignedTo: assignedToName || 'Unassigned',
              description: (wi.fields['System.Description'] || '').replace(/<[^>]*>/g, ''),
              project: wi.fields['System.TeamProject'],
              iteration: iteration,
              devopsUrl: `${devopsUrl}/${encodeURIComponent(project)}/_workitems/edit/${wi.id}`,
              boardColumn: importedColumnMap[wi.id] || null,
            };
          });

        allItems.push(...items);
      } catch (err) {
        const msg = err.message;
        if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('Forbidden')) {
          authError = 'Invalid or expired DevOps Personal Access Token (PAT)';
        }
        console.error(`Error fetching items for project ${project}:`, msg);
      }
    }

    if (authError) {
      return res.status(401).json({ error: authError });
    }

    // Deduplicate by work item ID (keep first occurrence)
    const seenIds = new Set();
    const deduplicatedItems = allItems.filter(item => {
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    });

    res.json(deduplicatedItems);
  } catch (err) {
    console.error('Error in GET /api/devops/tasks:', err);
    res.status(500).json({ error: 'Failed to fetch DevOps tasks', details: err.message });
  }
});

// POST /api/devops/import
app.post('/api/devops/import', async (req, res) => {
  try {
    const { devopsId, title, description, project, column } = req.body;

    if (!devopsId || !title || !column) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const settings = await readSettings();
    const completedCol = settings.columnDisplayNames?.Completed || 'Completed';

    const tasks = await readTasks();
    const importCol = column || 'Backlog';
    const importColTasks = tasks.filter(t => t.column === importCol);
    const importMaxOrder = importColTasks.reduce((max, t) => (t.order != null ? Math.max(max, t.order) : max), -1);

    const task = {
      id: uuidv4(),
      title: title.trim(),
      description: description ? description.trim().replace(/<[^>]*>/g, '') : '',
      customer: '',
      devopsTaskNum: parseInt(devopsId, 10),
      devopsItemUrl: req.body.devopsUrl || '',
      column: importCol,
      order: importMaxOrder + 1,
      dueDate: null,
      createdAt: new Date().toISOString(),
      completedAt: column === completedCol ? new Date().toISOString() : null,
      archivedAt: column === 'Archive' ? new Date().toISOString() : null,
    };

    tasks.push(task);
    await writeTasks(tasks);
    res.status(201).json(task);
  } catch (err) {
    console.error('Error in POST /api/devops/import:', err);
    res.status(500).json({ error: 'Failed to import DevOps task' });
  }
});

// Catch-all: serve React app for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initStorage()
  .then(() => {
    const actualPort = process.env.PORT || 5000;
    app.listen(actualPort, '0.0.0.0', () => {
      console.log(`Kanban backend running on port ${actualPort}`);
    });
  })
  .catch(err => {
    console.log('FATAL: Failed to initialize storage');
    console.log('Error: ' + err.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Verify System-assigned Managed Identity is ON on App Service');
    console.log('2. Verify App Service has "Storage Blob Data Contributor" role on Storage Account');
    console.log('3. Verify AZURE_STORAGE_ACCOUNT_NAME is set (or defaults to: sethappstorage)');
    console.log('4. Verify AZURE_STORAGE_CONTAINER_NAME is set (or defaults to: seth-kanban)');
    process.exit(1);
  });
