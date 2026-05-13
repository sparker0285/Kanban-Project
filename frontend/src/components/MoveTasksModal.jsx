import { useState } from 'react';

export default function MoveTasksModal({ column, taskCount, availableColumns, onMove, onCancel }) {
  const [selectedColumn, setSelectedColumn] = useState('');
  const [error, setError] = useState('');

  const handleMove = () => {
    if (!selectedColumn) {
      setError('Please select a destination column');
      return;
    }
    onMove(selectedColumn);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Move Tasks Before Removing Column</h3>
        <p className="modal-description">
          The <strong>"{column}"</strong> column contains <strong>{taskCount}</strong> task{taskCount !== 1 ? 's' : ''}.
          Where would you like to move them?
        </p>

        <label>
          Destination Column *
          <select
            value={selectedColumn}
            onChange={e => { setSelectedColumn(e.target.value); setError(''); }}
            autoFocus
          >
            <option value="">-- Select a column --</option>
            {availableColumns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel (Keep Column)
          </button>
          <button type="button" className="btn-primary" onClick={handleMove}>
            Move & Remove Column
          </button>
        </div>
      </div>
    </div>
  );
}
