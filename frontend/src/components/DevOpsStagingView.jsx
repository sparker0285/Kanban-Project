import { useEffect, useState } from 'react';
import { getDevopsTasks, importDevopsTask } from '../api';

const CACHE_KEY = 'devopsStagingCache';

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(items) {
  const now = new Date();
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    date: getTodayDateString(),
    fetchedAt: now.toISOString(),
    items,
  }));
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DevOpsStagingView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedIterations, setExpandedIterations] = useState({});
  const [importing, setImporting] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  useEffect(() => {
    const cache = loadCache();
    if (cache && cache.date === getTodayDateString()) {
      setItems(cache.items);
      setLastFetched(cache.fetchedAt || null);
      setLoading(false);
    } else {
      fetchItems();
    }
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDevopsTasks();
      const now = new Date().toISOString();
      setItems(result);
      saveCache(result);
      setLastFetched(now);
    } catch (err) {
      console.error('Failed to load DevOps items:', err);
      let errorMsg = 'Failed to load DevOps items';
      if (err.response?.status === 503) {
        errorMsg = err.response.data?.error || 'DevOps integration not configured. Check Key Vault secrets.';
      } else if (err.response?.status === 401) {
        errorMsg = err.response.data?.error || 'Authentication failed. Check your DevOps Personal Access Token.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }
      setError(errorMsg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectExpansion = (project) => {
    setExpandedProjects(prev => ({
      ...prev,
      [project]: !prev[project]
    }));
  };

  const expandAllProjects = () => {
    const expanded = {};
    sortedProjects.forEach(project => {
      expanded[project] = true;
    });
    setExpandedProjects(expanded);
  };

  const collapseAllProjects = () => {
    const collapsedProjects = {};
    const collapsedIterations = {};
    sortedProjects.forEach(project => {
      collapsedProjects[project] = false;
      const iterationsInProject = Object.keys(groupedItems[project] || {}).sort();
      iterationsInProject.forEach(iteration => {
        collapsedIterations[`${project}|${iteration}`] = false;
      });
    });
    setExpandedProjects(collapsedProjects);
    setExpandedIterations(collapsedIterations);
  };

  const toggleIterationExpansion = (key) => {
    setExpandedIterations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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
      const updated = items.filter(i => i.id !== item.id);
      setItems(updated);
      saveCache(updated);
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
           (item.description && item.description.toLowerCase().includes(query)) ||
           (item.project && item.project.toLowerCase().includes(query));
  });

  // Group by project, then by iteration
  const groupedItems = {};
  filteredItems.forEach(item => {
    if (!groupedItems[item.project]) {
      groupedItems[item.project] = {};
    }
    const iteration = item.iteration || '(No Iteration)';
    if (!groupedItems[item.project][iteration]) {
      groupedItems[item.project][iteration] = [];
    }
    groupedItems[item.project][iteration].push(item);
  });
  const sortedProjects = Object.keys(groupedItems).sort();

  // Default: expand all projects on first load
  useEffect(() => {
    if (sortedProjects.length > 0 && Object.keys(expandedProjects).length === 0) {
      const defaultExpanded = {};
      sortedProjects.forEach(project => {
        defaultExpanded[project] = true;
      });
      setExpandedProjects(defaultExpanded);
    }
  }, [items.length]);

  return (
    <div className="devops-staging-view">
      <div className="devops-staging-header">
        <h2>DevOps Staging</h2>
        <div className="devops-staging-toolbar">
          {lastFetched && <span className="devops-last-fetched">Last refreshed at {formatTime(lastFetched)}</span>}
          <button onClick={fetchItems} disabled={loading} className="btn-refresh-devops">
            {loading ? 'Refreshing...' : 'Refresh from DevOps'}
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by title or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredItems.length > 0 && (
        <div className="expand-collapse-buttons">
          <button onClick={expandAllProjects} className="btn-expand-all">
            Expand All
          </button>
          <button onClick={collapseAllProjects} className="btn-collapse-all">
            Collapse All
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!error && (
        <p className="task-count-info">
          {filteredItems.length} of {items.length} items
        </p>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="no-tasks">Please check your DevOps configuration and try again.</p>
      ) : filteredItems.length === 0 ? (
        <p className="no-tasks">
          {items.length === 0 ? 'No DevOps items to stage. Configure projects in Settings.' : 'No items match your search.'}
        </p>
      ) : (
        <div className="devops-items-list">
          {sortedProjects.map(project => {
            const isProjectExpanded = expandedProjects[project] !== false;
            const iterationsInProject = Object.keys(groupedItems[project]).sort();

            return (
            <div key={project} className="devops-project-group">
              <div
                className="project-group-header"
                onClick={() => toggleProjectExpansion(project)}
                style={{ cursor: 'pointer' }}
              >
                <span className="project-toggle-icon">{isProjectExpanded ? '▼' : '▶'}</span>
                {project}
              </div>
              {isProjectExpanded && (
                <div className="project-items-container">
                  {iterationsInProject.map(iteration => {
                    const iterationKey = `${project}|${iteration}`;
                    const isIterationExpanded = expandedIterations[iterationKey] !== false;

                    return (
                    <div key={iterationKey} className="devops-iteration-group">
                      <div
                        className="iteration-group-header"
                        onClick={() => toggleIterationExpansion(iterationKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="iteration-toggle-icon">{isIterationExpanded ? '▼' : '▶'}</span>
                        {iteration}
                      </div>
{isIterationExpanded && (
                        <div className="iteration-items-container">
                          {groupedItems[project][iteration].map(item => (
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
                    <span>{item.assignedTo || 'Unassigned'}</span>
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
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
