require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 5000;
const KEYVAULT_URL = process.env.AZURE_KEYVAULT_URL;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;

let containerClient;

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
};

async function initStorage() {
  const credential = new DefaultAzureCredential();
  const kvClient = new SecretClient(KEYVAULT_URL, credential);
  const secret = await kvClient.getSecret('storage-connection-string');
  const blobService = BlobServiceClient.fromConnectionString(secret.value);
  containerClient = blobService.getContainerClient(CONTAINER_NAME);
  console.log(`Connected to storage container: ${CONTAINER_NAME}`);
}

async function readBlob(blobName, defaultValue) {
  try {
    const buf = await containerClient.getBlockBlobClient(blobName).downloadToBuffer();
    return JSON.parse(buf.toString());
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
}

async function readSettings() {
  return readBlob('settings.json', DEFAULT_SETTINGS);
}

async function writeSettings(data) {
  return writeBlob('settings.json', data);
}

async function readTasks() {
  const data = await readBlob('tasks.json', { tasks: [] });
  return data.tasks || data;
}

async function writeTasks(tasks) {
  const settings = await readSettings();
  return writeBlob('tasks.json', { tasks, columns: settings.columns });
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
    const { title, description, column, customer, devopsTaskNum } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const settings = await readSettings();
    const completedCol = settings.columnDisplayNames?.Completed || 'Completed';

    const task = {
      id: uuidv4(),
      title: title.trim(),
      description: description ? description.trim() : '',
      customer: customer ? customer.trim() : '',
      devopsTaskNum: devopsTaskNum || null,
      column: column || 'Backlog',
      createdAt: new Date().toISOString(),
      completedAt: column === completedCol ? new Date().toISOString() : null,
      archivedAt: column === 'Archive' ? new Date().toISOString() : null,
    };

    const tasks = await readTasks();
    tasks.push(task);
    await writeTasks(tasks);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
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
    const updated = { ...existing, ...req.body };

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

// Catch-all: serve React app for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initStorage()
  .then(() => app.listen(PORT, () => console.log(`Kanban backend running on port ${PORT}`)))
  .catch(err => {
    console.error('Failed to initialize storage:', err.message);
    process.exit(1);
  });
