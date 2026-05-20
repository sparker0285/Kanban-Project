import { Draggable } from '@hello-pangea/dnd';

export default function TaskCard({ task, index, onDelete, onEdit, onViewDetail, showCompletedDate }) {
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
