import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useMatch } from 'react-router-dom';
import UploadPage from './pages/UploadPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import ChatbotPage from './pages/ChatbotPage.jsx';
import { getHealth } from './api/client.js';
import Disclaimer from './components/Disclaimer.jsx';
import WorkspaceNavigation, { RESULT_SECTIONS } from './components/Sidebar.jsx';
import './styles/sidebar.css';

const RESULT_STORAGE_KEY = 'telusurfin:last_result';

function hasResult(state) {
  if (state?.result || import.meta.env.VITE_USE_MOCK === 'true') return true;
  try {
    return Boolean(JSON.parse(sessionStorage.getItem(RESULT_STORAGE_KEY)));
  } catch {
    return false;
  }
}

export default function App() {
  const location = useLocation();
  const resultRoute = Boolean(useMatch('/result'));
  const chatRoute = Boolean(useMatch('/chatbot/*'));
  const [features, setFeatures] = useState(null);
  const showResultSections = resultRoute && hasResult(location.state);
  const requestedSection = location.hash === '#tier' ? 'rasio' : location.hash.slice(1);
  const activeSection = RESULT_SECTIONS.find(({ id }) => id === requestedSection)?.id ?? 'ringkasan';

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => { if (active) setFeatures(health.features ?? {}); })
      .catch(() => { if (active) setFeatures({}); });
    return () => { active = false; };
  }, [resultRoute, chatRoute]);

  useEffect(() => {
    if (!showResultSections) return;

    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.getElementById(`${activeSection}-heading`)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSection, showResultSections]);

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>Lewati navigasi</a>
      <WorkspaceNavigation
        resultRoute={resultRoute}
        showResultSections={showResultSections}
        activeSection={activeSection}
        chatRoute={chatRoute}
        chatPageAvailable={Boolean(features?.chat_page)}
      />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/result" element={<ResultPage activeSection={activeSection} features={features} />} />
          <Route path="/chatbot" element={<ChatbotPage features={features} />} />
          <Route path="/chatbot/:sessionId" element={<ChatbotPage features={features} />} />
        </Routes>
        <Disclaimer />
      </div>
    </div>
  );
}
