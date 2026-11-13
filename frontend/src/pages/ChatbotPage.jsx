import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createChatSession,
  deleteChatSession,
  listAnalyses,
  listChatSessions,
  patchChatSession,
} from '../api/chat.js';
import ChatPanel from '../components/ChatPanel.jsx';

const GLOSSARY = 'glossary';

function chatUrl(id) {
  return `/chatbot/${encodeURIComponent(id)}`;
}

function hasLastResult() {
  try {
    return Boolean(sessionStorage.getItem('telusurfin:last_result'));
  } catch {
    return false;
  }
}

function reportLabel(report) {
  if (!report?.ticker) return 'Kamus keuangan';
  return [report.ticker, report.period_type, report.period_end].filter(Boolean).join(' · ');
}

function SessionActions({ session, onRename, onDelete }) {
  const [action, setAction] = useState('');
  const [title, setTitle] = useState(session.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function choose(next) {
    setError('');
    setAction(next);
    setTitle(session.title ?? '');
  }

  async function apply(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'rename') await onRename(session.id, title.trim());
      if (action === 'delete') await onDelete(session.id);
      setAction('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tf-chat-session-actions">
      {!action ? (
        <>
          <button className="btn-secondary" type="button" onClick={() => choose('rename')}>Ganti judul</button>
          <button className="btn-secondary" type="button" onClick={() => choose('delete')}>Hapus</button>
        </>
      ) : (
        <form className="tf-chat-new-form" onSubmit={apply}>
          {action === 'rename' ? (
            <label>
              Judul percakapan
              <input value={title} maxLength={80} required onChange={(event) => setTitle(event.target.value)} />
            </label>
          ) : (
            <p>Hapus percakapan ini beserta semua pesannya?</p>
          )}
          {error && <p className="tf-chat-error" role="alert">{error}</p>}
          <div className="tf-chat-tools">
            <button className="btn-secondary" type="button" disabled={busy} onClick={() => choose('')}>Batal</button>
            <button className="btn-primary" type="submit" disabled={busy || (action === 'rename' && !title.trim())}>
              {action === 'rename' ? 'Simpan' : 'Hapus sesi'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ChatbotPage({ features = null }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const enabled = Boolean(features?.chat && features?.chat_page);
  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [reportError, setReportError] = useState('');
  const [createError, setCreateError] = useState('');
  const [selected, setSelected] = useState(GLOSSARY);
  const [creating, setCreating] = useState(false);
  const historyRequest = useRef(0);
  const headingRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [sessionId]);

  const refreshSessions = useCallback(async () => {
    const request = ++historyRequest.current;
    setSessionError('');
    try {
      const rows = await listChatSessions();
      if (request === historyRequest.current) setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (request === historyRequest.current) setSessionError(err.message);
    } finally {
      if (request === historyRequest.current) setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    setLoadingSessions(true);
    setLoadingReports(true);
    setReportError('');
    refreshSessions();
    listAnalyses()
      .then((rows) => {
        if (mounted) setReports(Array.isArray(rows) ? rows.filter((row) => row.file_id) : []);
      })
      .catch((err) => {
        if (mounted) setReportError(err.message);
      })
      .finally(() => {
        if (mounted) setLoadingReports(false);
      });
    return () => {
      mounted = false;
      historyRequest.current += 1;
    };
  }, [enabled, refreshSessions]);

  async function startSession(event) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const session = await createChatSession(selected === GLOSSARY
        ? { mode: 'glossary_only', origin: 'chatbot' }
        : { file_id: selected, origin: 'chatbot' });
      navigate(chatUrl(session.id));
      await refreshSessions();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function renameSession(id, title) {
    const updated = await patchChatSession(id, { title });
    setSessions((previous) => previous.map((row) => row.id === id ? { ...row, title: updated.title } : row));
  }

  async function removeSession(id) {
    await deleteChatSession(id);
    setSessions((previous) => previous.filter((row) => row.id !== id));
    if (id === sessionId) navigate('/chatbot', { replace: true });
    await refreshSessions();
  }

  const activeSession = sessions.find((session) => session.id === sessionId);
  const lastResult = hasLastResult();

  return (
    <main id="main-content" className="page-container tf-chat--page" tabIndex={-1}>
      <header className="tf-chat-hero">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>Asisten AI TelusurFin</h1>
          <p>Tanyakan istilah keuangan atau bahas hasil analisis emitenmu.</p>
        </div>
        <Link className="btn-secondary tf-chat-back" to={lastResult ? '/result' : '/'}>
          {lastResult ? 'Kembali ke analisis terakhir' : 'Unggah laporan'}
        </Link>
      </header>

      {enabled ? (
        <div className="tf-chat-layout">
          <aside className="tf-chat-context" aria-label="Sesi percakapan">
            <h2>Sesi percakapan</h2>
            <form className="tf-chat-new-form" onSubmit={startSession}>
              <label htmlFor="tf-chat-report">Sumber sesi baru</label>
              <select id="tf-chat-report" value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value={GLOSSARY}>Kamus keuangan</option>
                {reports.map((report) => (
                  <option key={report.file_id} value={report.file_id}>{reportLabel(report)}</option>
                ))}
              </select>
              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? 'Menyiapkan sesi…' : 'Mulai sesi'}
              </button>
              {loadingReports && <p className="tf-chat-status" role="status">Memuat daftar laporan…</p>}
              {reportError && <p className="tf-chat-error" role="alert">Gagal memuat daftar laporan. {reportError}</p>}
              {createError && <p className="tf-chat-error" role="alert">{createError}</p>}
            </form>
            <h3>Riwayat</h3>
            {loadingSessions && <p className="tf-chat-status" role="status">Memuat riwayat…</p>}
            {sessionError && (
              <div>
                <p className="tf-chat-error" role="alert">{sessionError}</p>
                <button type="button" className="btn-secondary" onClick={refreshSessions}>Muat ulang riwayat</button>
              </div>
            )}
            {sessions.length > 0 ? (
              <ul className="tf-chat-session-list">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link className="tf-chat-session-link" to={chatUrl(session.id)}
                      aria-current={session.id === sessionId ? 'page' : undefined}>
                      <strong>{session.title || 'Sesi tanpa judul'}</strong>
                      <small>{reportLabel(session.analysis)}</small>
                    </Link>
                    {session.id === sessionId && (
                      <SessionActions session={session} onRename={renameSession} onDelete={removeSession} />
                    )}
                  </li>
                ))}
              </ul>
            ) : !loadingSessions && !sessionError && <p className="tf-chat-status">Belum ada percakapan.</p>}
          </aside>

          {sessionId ? (
            <ChatPanel key={sessionId} sessionId={sessionId} title={activeSession?.title} fullPage
              onSessionChange={refreshSessions} />
          ) : (
            <section className="tf-chat tf-chat-empty" aria-labelledby="tf-chat-start">
              <h2 id="tf-chat-start">Mulai percakapan</h2>
              <p>Pilih laporan dari daftar untuk bertanya tentang angkanya. Pilih Kamus keuangan untuk bertanya tentang istilah seperti ROE atau rasio lancar.</p>
            </section>
          )}
        </div>
      ) : (
        <section className="tf-chat tf-chat-empty" aria-labelledby="tf-chat-availability">
          <h2 id="tf-chat-availability">{features === null ? 'Memeriksa asisten…' : 'Halaman Asisten AI belum tersedia'}</h2>
          <p role={features === null ? 'status' : undefined}>
            {features === null
              ? 'Sedang memeriksa layanan percakapan.'
              : 'Layanan yang terhubung belum mengaktifkan halaman percakapan.'}
          </p>
        </section>
      )}
    </main>
  );
}
