import { Draggable } from '@hello-pangea/dnd';

export default function TaskCard({ task, index, onDelete, onEdit, onViewDetail, showCompletedDate, showCreatedDate, staleTaskDays }) {
  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(task);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  const handleBodyClick = () => {
    onViewDetail(task);
  };

  const displayTitle = task.devopsTaskNum
    ? `#${task.devopsTaskNum} - ${task.title}`
    : task.title;

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCompletedDateDisplay = () => {
    if (task.completedAt) return formatDate(task.completedAt);
    if (task.archivedAt) return formatDate(task.archivedAt);
    return '';
  };

  const getAgeDays = () => {
    if (!task.createdAt) return 0;
    return Math.floor((Date.now() - new Date(task.createdAt)) / (1000 * 60 * 60 * 24));
  };
  const isStale = staleTaskDays != null && getAgeDays() >= staleTaskDays;

  const getDueDateBadge = () => {
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.ceil((dueDay - today) / (1000 * 60 * 60 * 24));
    const label = diffDays < 0 ? 'Overdue' : `Due ${formatDate(task.dueDate)}`;
    const cls = diffDays < 0 ? 'due-red' : diffDays <= 2 ? 'due-yellow' : 'due-green';
    return { label, cls };
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          className={`task-card${snapshot.isDragging ? ' dragging' : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="task-card-body" onClick={handleBodyClick} style={{ cursor: 'pointer' }}>
            {task.devopsItemUrl ? (
              <a
                href={task.devopsItemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="task-title task-title-link"
                onClick={e => e.stopPropagation()}
                title="Open in Azure DevOps"
              >
                {displayTitle} ↗
              </a>
            ) : (
              <p className="task-title">{displayTitle}</p>
            )}
            {task.customer && <p className="task-customer">{task.customer}</p>}
            {task.description && <p className="task-desc">{task.description}</p>}
            {showCompletedDate && <p className="task-completed-date">{getCompletedDateDisplay()}</p>}
            {showCreatedDate && task.createdAt && (
              <p className="task-created-date">Added {formatDate(task.createdAt)}</p>
            )}
            {isStale && <p className="task-stale-badge">{getAgeDays()}d old</p>}
            {(() => { const d = getDueDateBadge(); return d ? <p className={`task-due-date ${d.cls}`}>{d.label}</p> : null; })()}
          </div>
          <div className="task-card-actions">
            <button
              className="edit-btn"
              onClick={handleEdit}
              title="Edit task"
            >
              ✏️
            </button>
            <button
              className="delete-btn"
              onClick={handleDelete}
              title="Delete task"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}
