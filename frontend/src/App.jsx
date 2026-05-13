import { useState, useEffect } from 'react';
import Board from './components/Board';
import CompletedView from './components/CompletedView';
import ArchivedView from './components/ArchivedView';
import SettingsView from './components/SettingsView';
import { getSettings } from './api';
import './index.css';

export default function App() {
  const [view, setView] = useState('board');
  const [darkMode, setDarkMode] = useState(true);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
      setDarkMode(data.darkMode);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDarkModeChange = (isDark) => {
    setDarkMode(isDark);
  };

  const handleSettingsUpdate = (newSettings) => {
    setSettings(newSettings);
  };

  if (loading) {
    return <div className="app"><div className="loading">Loading...</div></div>;
  }

  const boardName = settings?.boardName || 'Kanban Task Board';

  return (
    <div className={`app${darkMode ? ' dark-mode' : ''}`}>
      <header className="app-header">
        <h1>{boardName}</h1>
        <nav className="nav-tabs">
          <button
            className={`nav-tab${view === 'board' ? ' active' : ''}`}
            onClick={() => setView('board')}
          >
            Board
          </button>
          <button
            className={`nav-tab${view === 'completed' ? ' active' : ''}`}
            onClick={() => setView('completed')}
          >
            Completed
          </button>
          <button
            className={`nav-tab${view === 'archived' ? ' active' : ''}`}
            onClick={() => setView('archived')}
          >
            Archived
          </button>
          <button
            className={`nav-tab${view === 'settings' ? ' active' : ''}`}
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'board' && settings && <Board settings={settings} />}
        {view === 'completed' && <CompletedView />}
        {view === 'archived' && <ArchivedView />}
        {view === 'settings' && (
          <SettingsView
            onDarkModeChange={handleDarkModeChange}
            onSettingsUpdate={handleSettingsUpdate}
          />
        )}
      </main>
    </div>
  );
}
