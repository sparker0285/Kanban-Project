export default function TaskDetailModal({ task, onEdit, onClose, onMove }) {
  const formatDate = (isoString) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-detail" onClick={e => e.stopPropagation()}>
        <div className="modal-detail-header">
          <div className="modal-detail-title-row">
            {task.devopsItemUrl ? (
              <a
                href={task.devopsItemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-detail-title-link"
              >
                {task.devopsTaskNum ? `#${task.devopsTaskNum} — ` : ''}{task.title} ↗
              </a>
            ) : (
              <h3 className="modal-detail-title">
                {task.devopsTaskNum ? `#${task.devopsTaskNum} — ` : ''}{task.title}
              </h3>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {task.customer && (
          <p className="modal-detail-customer">{task.customer}</p>
        )}

        <div className="modal-detail-body">
          {task.description ? (
            <p className="modal-detail-description">{task.description}</p>
          ) : (
            <p className="modal-detail-description modal-detail-empty">(no description)</p>
          )}
        </div>

        <div className="modal-detail-meta">
          <span>Column: <strong>{task.column}</strong></span>
          {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {task.createdAt && <span>Created: {formatDate(task.createdAt)}</span>}
          {task.completedAt && <span>Completed: {formatDate(task.completedAt)}</span>}
          {task.archivedAt && <span>Archived: {formatDate(task.archivedAt)}</span>}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {task.column !== 'Completed' && (
            <button className="btn-complete" onClick={() => onMove(task.id, 'Completed')}>Mark Complete</button>
          )}
          {task.column !== 'Archive' && (
            <button className="btn-archive" onClick={() => onMove(task.id, 'Archive')}>Archive</button>
          )}
          <button className="btn-primary" onClick={() => { onClose(); onEdit(task); }}>Edit</button>
        </div>
      </div>
    </div>
  );
}
