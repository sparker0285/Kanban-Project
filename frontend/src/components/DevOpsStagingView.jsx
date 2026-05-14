import { useEffect, useState } from 'react';
import { getDevopsTasks, importDevopsTask } from '../api';

export default function DevOpsStagingView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [importing, setImporting] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const result = await getDevopsTasks();
      setItems(result);
    } catch (err) {
      console.error('Failed to load DevOps items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item, column) => {
    setImporting(item.id);
    try {
      await importDevopsTask({
        devopsId: item.id,
        title: item.title,
        description: item.description,
        project: item.project,
        column,
        devopsUrl: item.devopsUrl,
      });
      setItems(items.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to import task:', err);
    } finally {
      setImporting(null);
    }
  };

  const truncateText = (text, length) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  const getStateBadgeColor = (state) => {
    const stateMap = {
      'New': '#3b82f6',
      'Active': '#f59e0b',
      'Resolved': '#10b981',
      'Closed': '#6b7280',
    };
    return stateMap[state] || '#9ca3af';
  };

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const query = search.toLowerCase();
    return item.title.toLowerCase().includes(query) ||
           (item.description && item.description.toLowerCase().includes(query));
  });

  return (
    <div className="devops-staging-view">
      <h2>DevOps Staging</h2>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by title or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <p className="task-count-info">
        {filteredItems.length} of {items.length} items
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p className="no-tasks">
          {items.length === 0 ? 'No DevOps items to stage. Configure projects in Settings.' : 'No items match your search.'}
        </p>
      ) : (
        <div className="devops-items-list">
          {filteredItems.map(item => (
            <div key={item.id} className="devops-item">
              <div className="item-header" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="item-badges">
                  <span
                    className="badge badge-type"
                    style={{
                      backgroundColor: item.type === 'Bug' ? '#ef4444' : '#8b5cf6',
                    }}
                  >
                    {item.type}
                  </span>
                  <span
                    className="badge badge-state"
                    style={{ backgroundColor: getStateBadgeColor(item.state) }}
                  >
                    {item.state}
                  </span>
                </div>
                <div className="item-header-content">
                  <a
                    href={item.devopsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="item-title-link"
                    onClick={e => e.stopPropagation()}
                  >
                    #{item.id} — {item.title}
                  </a>
                  <p className="item-desc-preview">
                    {truncateText(item.description || '(no description)', 60)}
                  </p>
                  <p className="item-meta">
                    <span>{item.project}</span> • <span>{item.assignedTo || 'Unassigned'}</span>
                  </p>
                </div>
                <button className="expand-btn" title={expandedId === item.id ? 'Collapse' : 'Expand'}>
                  {expandedId === item.id ? '▼' : '▶'}
                </button>
              </div>
              {expandedId === item.id && (
                <div className="item-details">
                  {item.description && (
                    <div className="detail-section">
                      <p className="detail-label">Description:</p>
                      <p className="detail-value">{item.description}</p>
                    </div>
                  )}
                  <div className="detail-section">
                    <p className="detail-label">Project:</p>
                    <p className="detail-value">{item.project}</p>
                  </div>
                  <div className="detail-section">
                    <p className="detail-label">State:</p>
                    <p className="detail-value">{item.state}</p>
                  </div>
                  <div className="item-actions">
                    <button
                      onClick={() => handleImport(item, 'Backlog')}
                      disabled={importing === item.id}
                      className="btn-primary"
                    >
                      {importing === item.id ? '...' : 'Add to Backlog'}
                    </button>
                    <button
                      onClick={() => handleImport(item, 'Priority')}
                      disabled={importing === item.id}
                      className="btn-secondary"
                    >
                      {importing === item.id ? '...' : 'Add to Priority'}
                    </button>
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
