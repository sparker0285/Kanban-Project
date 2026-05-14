import { useState } from 'react';

export default function EditTaskModal({ task, onSave, onClose, columns }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [customer, setCustomer] = useState(task.customer || '');
  const [devopsTaskNum, setDevopsTaskNum] = useState(task.devopsTaskNum || '');
  const [column, setColumn] = useState(task.column);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    onSave(task.id, {
      title: title.trim(),
      description: description.trim(),
      customer: customer.trim(),
      devopsTaskNum: devopsTaskNum ? parseInt(devopsTaskNum) : null,
      column,
    });
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Task</h3>
        <form onSubmit={handleSubmit}>
          <label>
            Title *
            <input
              autoFocus
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              placeholder="Task title"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <label>
            Description
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional details"
              rows={2}
            />
          </label>
          <label>
            Project/Customer
            <input
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="Project or customer name"
            />
          </label>
          <label>
            DevOps Task #
            <input
              type="number"
              value={devopsTaskNum}
              onChange={e => setDevopsTaskNum(e.target.value)}
              placeholder="Task number (optional)"
            />
          </label>
          <label>
            Column
            <select value={column} onChange={e => setColumn(e.target.value)}>
              {columns && columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </label>
          <p className="task-meta">Created: {formatDate(task.createdAt)}</p>
          {task.completedAt && <p className="task-meta">Completed: {formatDate(task.completedAt)}</p>}
          {task.archivedAt && <p className="task-meta">Archived: {formatDate(task.archivedAt)}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
