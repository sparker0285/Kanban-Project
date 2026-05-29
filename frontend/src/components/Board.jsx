import { useEffect, useState, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './Column';
import AddTaskModal from './AddTaskModal';
import EditTaskModal from './EditTaskModal';
import TaskDetailModal from './TaskDetailModal';
import { getTasks, createTask, updateTask, deleteTask, reorderTasks } from '../api';

export default function Board({ settings }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalColumn, setModalColumn] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef(null);

  const COMPLETED_COLUMN = 'Completed';
  const ARCHIVE_COLUMN = 'Archive';
  const DATE_ORDERED_COLUMNS = [COMPLETED_COLUMN, ARCHIVE_COLUMN];
  const BOARD_MAX_ITEMS = 5;

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
    const { draggableId, source, destination } = result;
    if (!destination) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    const sameColumn = task.column === destination.droppableId;

    // Nothing to do if dropped in same position in a date-ordered column
    if (sameColumn && DATE_ORDERED_COLUMNS.includes(destination.droppableId)) return;

    // Capture snapshot for undo before any changes
    const snapshot = tasks.map(t => ({ ...t }));

    try {
      const updates = {};
      const reorders = [];

      if (!sameColumn) {
        updates.column = destination.droppableId;
        // Set timestamps on frontend for immediate UI update
        const completedCol = settings?.columnDisplayNames?.Completed || 'Completed';
        if (destination.droppableId === completedCol && !task.completedAt) {
          updates.completedAt = new Date().toISOString();
        }
        if (destination.droppableId === 'Archive' && !task.archivedAt) {
          updates.archivedAt = new Date().toISOString();
        }
      }

      // Build reorder payloads for user-ordered columns
      if (!DATE_ORDERED_COLUMNS.includes(destination.droppableId)) {
        const destTasks = tasks
          .filter(t => t.column === destination.droppableId && t.id !== draggableId)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        destTasks.splice(destination.index, 0, { id: draggableId });
        reorders.push({ column: destination.droppableId, taskIds: destTasks.map(t => t.id) });
      }
      if (!sameColumn && !DATE_ORDERED_COLUMNS.includes(source.droppableId)) {
        const srcTasks = tasks
          .filter(t => t.column === source.droppableId && t.id !== draggableId)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        reorders.push({ column: source.droppableId, taskIds: srcTasks.map(t => t.id) });
      }

      if (!sameColumn) {
        // Batch column change + reorders into a single request
        await updateTask(draggableId, reorders.length > 0 ? { ...updates, reorders } : updates);
      } else if (reorders.length > 0) {
        await reorderTasks(reorders);
      }

      // Update local state
      let newTasks = tasks.map(t => t.id === draggableId ? { ...t, ...updates } : t);
      reorders.forEach(({ taskIds }) => {
        taskIds.forEach((id, idx) => {
          newTasks = newTasks.map(t => t.id === id ? { ...t, order: idx } : t);
        });
      });
      setTasks(newTasks);

      // Show undo toast
      setUndoSnapshot(snapshot);
      setShowUndoToast(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setShowUndoToast(false);
        setUndoSnapshot(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
    }
  };

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    clearTimeout(undoTimerRef.current);
    setShowUndoToast(false);

    const currentTasks = tasks;
    setTasks(undoSnapshot);
    setUndoSnapshot(null);

    try {
      // Find the task that changed
      const changedTask = undoSnapshot.find(snapTask => {
        const cur = currentTasks.find(t => t.id === snapTask.id);
        return cur && (cur.column !== snapTask.column || cur.order !== snapTask.order);
      });
      if (!changedTask) return;

      const curTask = currentTasks.find(t => t.id === changedTask.id);
      const reorders = [];

      if (!DATE_ORDERED_COLUMNS.includes(changedTask.column)) {
        const snapColTasks = undoSnapshot
          .filter(t => t.column === changedTask.column)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        reorders.push({ column: changedTask.column, taskIds: snapColTasks.map(t => t.id) });
      }
      if (curTask.column !== changedTask.column && !DATE_ORDERED_COLUMNS.includes(curTask.column)) {
        const snapSrcTasks = undoSnapshot
          .filter(t => t.column === curTask.column)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        reorders.push({ column: curTask.column, taskIds: snapSrcTasks.map(t => t.id) });
      }

      if (curTask.column !== changedTask.column) {
        await updateTask(changedTask.id, {
          column: changedTask.column,
          completedAt: changedTask.completedAt,
          archivedAt: changedTask.archivedAt,
          ...(reorders.length > 0 && { reorders }),
        });
      } else if (reorders.length > 0) {
        await reorderTasks(reorders);
      }
    } catch (err) {
      console.error('Failed to undo drag:', err);
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

  const handleMoveTask = async (id, column) => {
    try {
      const task = tasks.find(t => t.id === id);
      const updates = { column };
      const completedCol = settings?.columnDisplayNames?.Completed || 'Completed';
      if (column === completedCol && !task.completedAt) updates.completedAt = new Date().toISOString();
      if (column === 'Archive' && !task.archivedAt) updates.archivedAt = new Date().toISOString();
      await updateTask(id, updates);
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
      setDetailTask(null);
    } catch (err) {
      console.error('Failed to move task:', err);
      setError('Failed to move task');
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

  const getTasksByColumn = (column) => {
    let columnTasks = tasks.filter(t => t.column === column);

    if (column === COMPLETED_COLUMN) {
      return columnTasks
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, BOARD_MAX_ITEMS);
    }
    if (column === ARCHIVE_COLUMN) {
      return columnTasks
        .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt))
        .slice(0, BOARD_MAX_ITEMS);
    }

    // User-ordered columns: sort by order field (null → end)
    return columnTasks.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
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
              onViewDetail={setDetailTask}
              color={getColumnColor(column)}
              showCompletedDate={column === COMPLETED_COLUMN || column === ARCHIVE_COLUMN}
              showCreatedDate={column === 'Backlog'}
              staleTaskDays={(() => {
                if (DATE_ORDERED_COLUMNS.includes(column)) return null;
                const s = settings?.staleTaskDays;
                if (!s) return 14;
                if (typeof s === 'number') return s; // backward compat
                return s[column] ?? 14;
              })()}
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

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onEdit={setEditingTask}
          onClose={() => setDetailTask(null)}
          onMove={handleMoveTask}
        />
      )}

      {showUndoToast && (
        <div className="undo-toast">
          Task moved.
          <button className="undo-toast-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
