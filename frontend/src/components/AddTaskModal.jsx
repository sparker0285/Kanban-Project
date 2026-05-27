import { useState } from 'react';

export default function AddTaskModal({ column, onAdd, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customer, setCustomer] = useState('');
  const [devopsTaskNum, setDevopsTaskNum] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    onAdd({
      title: title.trim(),
      description: description.trim(),
      customer: customer.trim(),
      devopsTaskNum: devopsTaskNum ? parseInt(devopsTaskNum) : null,
      dueDate: dueDate || null,
      column,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add Task to {column}</h3>
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
            Due Date
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}
