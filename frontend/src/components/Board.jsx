import { useEffect, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './Column';
import AddTaskModal from './AddTaskModal';
import EditTaskModal from './EditTaskModal';
import { getTasks, createTask, updateTask, deleteTask } from '../api';

export default function Board({ settings }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalColumn, setModalColumn] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const COMPLETED_COLUMN = 'Completed';
  const ARCHIVE_COLUMN = 'Archive';
  const DAYS_TO_SHOW = 7;

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await getTasks();
      setTasks(data);
      setError('');
    } catch (err) {
      setError('Failed to load tasks. Ensure backend is running on http://localhost:5000');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task || task.column === destination.droppableId) return;

    try {
      const updates = { column: destination.droppableId };
      await updateTask(draggableId, updates);
      setTasks(
        tasks.map(t =>
          t.id === draggableId ? { ...t, column: destination.droppableId } : t
        )
      );
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
    }
  };

  const handleEditTask = async (id, updates) => {
    try {
      await updateTask(id, updates);
      setTasks(
        tasks.map(t => (t.id === id ? { ...t, ...updates } : t))
      );
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      const newTask = await createTask(taskData);
      setTasks([...tasks, newTask]);
      setModalColumn(null);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
    }
  };

  const isWithinLastDays = (timestamp, days) => {
    if (!timestamp) return false;
    const taskDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - taskDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  };

  const getTasksByColumn = (column) => {
    let columnTasks = tasks.filter(t => t.column === column);

    // Filter Completed and Archive columns to show only last 7 days
    if (column === COMPLETED_COLUMN) {
      columnTasks = columnTasks.filter(t => isWithinLastDays(t.completedAt, DAYS_TO_SHOW));
    } else if (column === ARCHIVE_COLUMN) {
      columnTasks = columnTasks.filter(t => isWithinLastDays(t.archivedAt, DAYS_TO_SHOW));
    }

    // Sort Completed and Archive by timestamp (newest first)
    if (column === COMPLETED_COLUMN) {
      columnTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    } else if (column === ARCHIVE_COLUMN) {
      columnTasks.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
    }

    return columnTasks;
  };

  const getColumnColor = (column) => {
    return settings?.columnColors?.[column] || '#999';
  };

  if (loading) {
    return <div className="board-container"><p>Loading tasks...</p></div>;
  }

  const columns = settings?.columns || [];

  return (
    <div className="board-container">
      {error && <div className="error-message">{error}</div>}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board">
          {columns.map(column => (
            <Column
              key={column}
              column={column}
              displayName={settings.columnDisplayNames?.[column] || column}
              tasks={getTasksByColumn(column)}
              onAddClick={setModalColumn}
              onDelete={handleDeleteTask}
              onEdit={setEditingTask}
              color={getColumnColor(column)}
              showCompletedDate={column === COMPLETED_COLUMN || column === ARCHIVE_COLUMN}
            />
          ))}
        </div>
      </DragDropContext>

      {modalColumn && (
        <AddTaskModal
          column={modalColumn}
          onAdd={handleAddTask}
          onClose={() => setModalColumn(null)}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={handleEditTask}
          onClose={() => setEditingTask(null)}
          columns={columns}
        />
      )}
    </div>
  );
}
