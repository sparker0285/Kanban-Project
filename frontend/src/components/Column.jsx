import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

export default function Column({ column, displayName, tasks, onAddClick, onDelete, onEdit, color, showCompletedDate }) {
  return (
    <div className="column">
      <div className="column-header" style={{ borderTopColor: color }}>
        <h2>{displayName}</h2>
        <span className="task-count">{tasks.length}</span>
      </div>

      <Droppable droppableId={column}>
        {(provided, snapshot) => (
          <div
            className={`task-list${snapshot.isDraggingOver ? ' drag-over' : ''}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onDelete={onDelete}
                onEdit={onEdit}
                showCompletedDate={showCompletedDate}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button className="add-task-btn" onClick={() => onAddClick(column)}>
        + Add Task
      </button>
    </div>
  );
}
