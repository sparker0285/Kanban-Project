import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getTasks, updateTask } from '../api';
import MoveTasksModal from './MoveTasksModal';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
];

export default function SettingsView({ onDarkModeChange, onSettingsUpdate }) {
  const [settings, setSettings] = useState(null);
  const [boardName, setBoardName] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [renamedColumns, setRenamedColumns] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [moveModal, setMoveModal] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
      setBoardName(data.boardName);
      setRenamedColumns(data.columnDisplayNames || {});
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    }
  };

  const handleDarkModeToggle = async () => {
    try {
      const newSettings = { ...settings, darkMode: !settings.darkMode };
      await updateSettings(newSettings);
      setSettings(newSettings);
      onDarkModeChange(!settings.darkMode);
      setSuccess('Dark mode updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update dark mode');
    }
  };

  const handleBoardNameChange = async () => {
    if (!boardName.trim()) {
      setError('Board name cannot be empty');
      return;
    }
    try {
      const newSettings = { ...settings, boardName: boardName.trim() };
      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setSuccess('Board name updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update board name');
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      setError('Column name cannot be empty');
      return;
    }
    if (settings.columns.includes(newColumnName.trim())) {
      setError('Column already exists');
      return;
    }

    try {
      const usedColors = settings.columns.map(col => settings.columnColors[col]);
      const availableColors = COLOR_PALETTE.filter(color => !usedColors.includes(color));

      if (availableColors.length === 0) {
        setError('Maximum columns reached (color palette full)');
        return;
      }

      const newColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      const newSettings = {
        ...settings,
        columns: [...settings.columns.slice(0, -1), newColumnName.trim(), settings.columns[settings.columns.length - 1]],
        columnColors: { ...settings.columnColors, [newColumnName.trim()]: newColor },
      };

      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setNewColumnName('');
      setError('');
      setSuccess('Column added!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to add column');
    }
  };

  const handleRemoveColumn = async (column) => {
    if (column === 'Completed' || column === 'Archive' || column === settings.columnDisplayNames.Completed) {
      setError('Cannot remove the Completed or Archive columns');
      return;
    }

    try {
      // Check if column has any tasks
      const tasksData = await getTasks();
      const tasksInColumn = tasksData.filter(t => t.column === column);

      if (tasksInColumn.length > 0) {
        // Show modal to select destination column
        const otherColumns = settings.columns.filter(c => c !== column);
        setMoveModal({
          column,
          taskCount: tasksInColumn.length,
          tasks: tasksInColumn,
          availableColumns: otherColumns,
        });
        return;
      }

      // No tasks, safe to remove
      await finalizeRemoveColumn(column);
    } catch (err) {
      console.error('Failed to remove column:', err);
      setError('Failed to check tasks in column');
    }
  };

  const finalizeRemoveColumn = async (column) => {
    try {
      const newColumns = settings.columns.filter(c => c !== column);
      const newColors = { ...settings.columnColors };
      delete newColors[column];

      const newSettings = {
        ...settings,
        columns: newColumns,
        columnColors: newColors,
      };

      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setMoveModal(null);
      setSuccess('Column removed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to remove column');
    }
  };

  const handleMoveTasksAndRemove = async (destinationColumn) => {
    try {
      const columnToRemove = moveModal.column;
      const tasksToMove = moveModal.tasks;

      // Move all tasks to destination
      for (const task of tasksToMove) {
        await updateTask(task.id, { column: destinationColumn });
      }

      // Now remove the column
      await finalizeRemoveColumn(columnToRemove);
    } catch (err) {
      console.error('Failed to move tasks and remove column:', err);
      setError('Failed to move tasks. Column was not removed.');
      setMoveModal(null);
    }
  };

  const handleRenameColumn = async (column, newName) => {
    if (!newName.trim()) {
      setError('Column name cannot be empty');
      return;
    }

    try {
      const newDisplayNames = { ...settings.columnDisplayNames };
      newDisplayNames[column] = newName.trim();

      const newSettings = { ...settings, columnDisplayNames: newDisplayNames };
      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setRenamedColumns(newDisplayNames);
      setSuccess('Column renamed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to rename column');
    }
  };

  const handleColorChange = async (column, newColor) => {
    try {
      const newSettings = {
        ...settings,
        columnColors: { ...settings.columnColors, [column]: newColor },
      };
      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setSuccess('Color updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update color');
    }
  };

  const handleReorderColumn = async (column, direction) => {
    const currentIndex = settings.columns.indexOf(column);
    let newIndex = currentIndex;

    if (direction === 'up' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < settings.columns.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return; // Can't move
    }

    try {
      const newColumns = [...settings.columns];
      [newColumns[currentIndex], newColumns[newIndex]] = [newColumns[newIndex], newColumns[currentIndex]];

      const newSettings = { ...settings, columns: newColumns };
      await updateSettings(newSettings);
      setSettings(newSettings);
      onSettingsUpdate(newSettings);
      setSuccess('Column order updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to reorder columns');
    }
  };

  if (!settings) {
    return <div className="settings-view"><p>Loading settings...</p></div>;
  }

  const completedColumnName = settings.columnDisplayNames.Completed || 'Completed';

  return (
    <div className="settings-view">
      <h2>Settings</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.darkMode}
              onChange={handleDarkModeToggle}
            />
            Dark Mode
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Board</h3>
        <div className="setting-item">
          <label>
            Board Name:
            <input
              type="text"
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              placeholder="Enter board name"
            />
          </label>
          <button onClick={handleBoardNameChange} className="btn-primary">
            Update
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Columns</h3>

        <div className="columns-list">
          {settings.columns.map((column, index) => (
            <div key={column} className="column-config">
              <div className="column-info">
                <input
                  type="text"
                  value={renamedColumns[column] || column}
                  onChange={e => {
                    const newRenames = { ...renamedColumns };
                    newRenames[column] = e.target.value;
                    setRenamedColumns(newRenames);
                  }}
                  onBlur={e => handleRenameColumn(column, e.target.value || column)}
                  disabled={column === completedColumnName}
                  className="column-name-input"
                />
                <div className="color-picker">
                  <input
                    type="color"
                    value={settings.columnColors[column]}
                    onChange={e => handleColorChange(column, e.target.value)}
                  />
                </div>
              </div>
              <div className="column-actions">
                <button
                  onClick={() => handleReorderColumn(column, 'up')}
                  disabled={index === 0}
                  className="btn-reorder"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleReorderColumn(column, 'down')}
                  disabled={index === settings.columns.length - 1}
                  className="btn-reorder"
                  title="Move down"
                >
                  ▼
                </button>
                {column !== completedColumnName && column !== 'Archive' && (
                  <button
                    onClick={() => handleRemoveColumn(column)}
                    className="btn-danger"
                    title="Remove column"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="add-column">
          <input
            type="text"
            value={newColumnName}
            onChange={e => setNewColumnName(e.target.value)}
            placeholder="New column name"
            onKeyPress={e => e.key === 'Enter' && handleAddColumn()}
          />
          <button onClick={handleAddColumn} className="btn-primary">
            + Add Column
          </button>
        </div>
        <p className="info-text">
          Completed column ({COLOR_PALETTE.length - settings.columns.length + 1} / {COLOR_PALETTE.length} colors available)
        </p>
      </div>

      {moveModal && (
        <MoveTasksModal
          column={moveModal.column}
          taskCount={moveModal.taskCount}
          availableColumns={moveModal.availableColumns}
          onMove={handleMoveTasksAndRemove}
          onCancel={() => setMoveModal(null)}
        />
      )}
    </div>
  );
}
