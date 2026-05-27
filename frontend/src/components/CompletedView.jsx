import { useEffect, useState } from 'react';
import { getCompletedTasks } from '../api';

export default function CompletedView() {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      const today = new Date();

      if (filter === 'last7') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0];
      } else if (filter === 'last-week') {
        const dow = today.getDay(); // 0=Sun
        const lastSat = new Date(today);
        lastSat.setDate(today.getDate() - dow - 1);
        const lastSun = new Date(lastSat);
        lastSun.setDate(lastSat.getDate() - 6);
        startDate = lastSun.toISOString().split('T')[0];
        endDate = lastSat.toISOString().split('T')[0];
      } else if (filter === 'last30') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
      }

      const result = await getCompletedTasks(startDate, endDate);
      setAllTasks(result.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
    } catch (err) {
      console.error('Failed to load completed tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  const exportCsv = () => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Title', 'Customer', 'DevOps #', 'Created', 'Completed', 'Description'];
    const rows = filteredTasks.map(t => [
      t.title,
      t.customer || '',
      t.devopsTaskNum || '',
      t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
      t.completedAt ? new Date(t.completedAt).toLocaleString() : '',
      t.description || '',
    ]);
    const csv = [headers.map(escape), ...rows.map(r => r.map(escape))].map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `completed-tasks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const truncateText = (text, length) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  const filteredTasks = allTasks.filter(task => {
    if (!search) return true;
    const query = search.toLowerCase();
    return task.title.toLowerCase().includes(query) ||
           (task.description && task.description.toLowerCase().includes(query)) ||
           (task.customer && task.customer.toLowerCase().includes(query));
  });

  return (
    <div className="completed-view">
      <h2>Completed Tasks</h2>

      <div className="filter-buttons">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className="export-csv-btn"
          onClick={exportCsv}
          title="Export visible tasks to CSV"
          style={{ marginLeft: 'auto' }}
        >
          ⬇ Export CSV
        </button>
        <button
          className={filter === 'last7' ? 'active' : ''}
          onClick={() => setFilter('last7')}
        >
          Last 7 days
        </button>
        <button
          className={filter === 'last-week' ? 'active' : ''}
          onClick={() => setFilter('last-week')}
        >
          Last week
        </button>
        <button
          className={filter === 'last30' ? 'active' : ''}
          onClick={() => setFilter('last30')}
        >
          Last 30 days
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by title, description, or customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <p className="task-count-info">
        {filteredTasks.length} of {allTasks.length} tasks
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : filteredTasks.length === 0 ? (
        <p className="no-tasks">
          {allTasks.length === 0 ? 'No completed tasks yet.' : 'No tasks match your search.'}
        </p>
      ) : (
        <div className="tasks-list">
          {filteredTasks.map(task => (
            <div key={task.id} className="completed-task-item">
              <div className="task-header" onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}>
                <div className="task-header-content">
                  {task.devopsItemUrl ? (
                    <a
                      href={task.devopsItemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="task-title task-title-link"
                      onClick={e => e.stopPropagation()}
                      title="Open in Azure DevOps"
                    >
                      {task.devopsTaskNum ? `#${task.devopsTaskNum} - ` : ''}{task.title} ↗
                    </a>
                  ) : (
                    <p className="task-title">
                      {task.devopsTaskNum ? `#${task.devopsTaskNum} - ` : ''}{task.title}
                    </p>
                  )}
                  <p className="task-desc-preview">
                    {truncateText(task.description || '(no description)', 50)}
                  </p>
                </div>
                <span className="task-completed-date-badge">{formatDate(task.completedAt)}</span>
                <button className="expand-btn" title={expandedId === task.id ? 'Collapse' : 'Expand'}>
                  {expandedId === task.id ? '▼' : '▶'}
                </button>
              </div>
              {expandedId === task.id && (
                <div className="task-details">
                  {task.description && (
                    <div className="detail-section">
                      <p className="detail-label">Description:</p>
                      <p className="detail-value">{task.description}</p>
                    </div>
                  )}
                  {task.customer && (
                    <div className="detail-section">
                      <p className="detail-label">Customer:</p>
                      <p className="detail-value">{task.customer}</p>
                    </div>
                  )}
                  {task.devopsTaskNum && (
                    <div className="detail-section">
                      <p className="detail-label">DevOps Task #:</p>
                      <p className="detail-value">#{task.devopsTaskNum}</p>
                    </div>
                  )}
                  <div className="detail-section">
                    <p className="detail-label">Created:</p>
                    <p className="detail-value">{formatDate(task.createdAt)}</p>
                  </div>
                  <div className="detail-section">
                    <p className="detail-label">Completed:</p>
                    <p className="detail-value">{formatDate(task.completedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
