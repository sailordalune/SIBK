import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../hooks/useChatSession.js';
import SourcePageLink from './SourcePageLink.jsx';
import '../styles/chat.css';

function ChatMessage({ message, session }) {
  const fileId = session?.analysis?.file_id;
  const fileUrl = session?.snapshot?.entity?.file_url;
  const pages = [...new Set((message.refs ?? []).flatMap((ref) => ref.pages ?? []))]
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((a, b) => a - b);

  return (
    <article className="tf-chat-message" data-role={message.role}>
      <div className="tf-chat-message-meta">
        <strong>{message.role === 'user' ? 'Kamu' : message.role === 'system' ? 'Sistem' : 'Asisten AI'}</strong>
        {message.label && <span>{message.label}</span>}
      </div>
      <p className="tf-chat-message-body">{message.content}</p>
      {pages.length > 0 && (
        <div className="tf-chat-source">
          <span>Rujukan PDF</span>
          {pages.map((page) => <SourcePageLink key={page} fileId={fileId} fileUrl={fileUrl} page={page} />)}
        </div>
      )}
      {message.dropped_sentences > 0 && (
        <small>{message.dropped_sentences} kalimat disaring karena tidak sesuai data.</small>
      )}
    </article>
  );
}

const REPORT_QUESTIONS = ['Apa arti tier emiten ini?', 'Berapa rasio lancar dan dari mana angkanya?'];
const GLOSSARY_QUESTIONS = ['Apa itu ROE?', 'Apa arti rasio lancar?'];

export default function ChatPanel({ result, sessionId, title = 'Asisten AI', fullPage = false,
  canExpand = false, onSessionChange, onClose }) {
  const headingId = useId();
  const navigate = useNavigate();
  const inputId = useId();
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState(null);
  const chat = useChatSession({ result, sessionId, onSessionChange });
  const { session, loading, sending, progress, error } = chat;
  const messages = session?.messages ?? [];
  const awaitingAnswer = sending || session?.pending;
  const busy = awaitingAnswer || expanding;
  const ticker = session?.analysis?.ticker ?? result?.entity?.ticker;
  const questions = ticker ? REPORT_QUESTIONS : GLOSSARY_QUESTIONS;

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages.length, progress]);

  async function submit(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    if (await chat.send(content)) setDraft('');
    inputRef.current?.focus();
  }

  async function openFullChat() {
    setExpandError(null);
    setExpanding(true);
    try {
      await chat.syncReport();
      navigate(`/chatbot/${encodeURIComponent(session.id)}`);
    } catch (err) {
      setExpandError(err.message);
    } finally {
      setExpanding(false);
    }
  }

  return (
    <section className={`tf-chat${fullPage ? ' tf-chat--page' : ''}`} aria-labelledby={headingId}>
      <header className="tf-chat-header">
        <div>
          <h2 id={headingId}>{title}</h2>
          <p>{ticker ? `Tanya tentang laporan ${ticker}.` : 'Tanya tentang istilah dan rasio keuangan.'}</p>
        </div>
        <div className="tf-chat-tools">
          {canExpand && session?.id && (
            <button className="btn-secondary" type="button" disabled={busy} onClick={openFullChat}>
              {expanding ? 'Membuka halaman chat…' : 'Buka halaman chat'}
            </button>
          )}
          {onClose && <button type="button" className="btn-secondary" onClick={onClose}>Tutup chat</button>}
        </div>
      </header>

      <div ref={threadRef} className="tf-chat-thread" role="log" aria-label="Percakapan dengan Asisten AI" tabIndex={0}>
        {loading && <p className="tf-chat-status">Menyiapkan percakapan…</p>}
        {!loading && !error && messages.length === 0 && !busy && (
          <div className="tf-chat-empty">
            <p>{ticker ? 'Mulai dari satu angka atau bagian laporan yang ingin kamu pahami.' : 'Mulai dengan istilah yang ingin kamu pahami.'}</p>
            <div className="tf-chat-suggestions">
              {questions.map((question) => (
                <button type="button" key={question} onClick={() => {
                  setDraft(question);
                  inputRef.current?.focus();
                }}>{question}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => <ChatMessage key={message.id} message={message} session={session} />)}
        {awaitingAnswer && messages.at(-1)?.role !== 'assistant' && (
          <article className="tf-chat-message" data-role="assistant">
            <div className="tf-chat-message-meta"><strong>Asisten AI</strong></div>
            <p className="tf-chat-message-body">{progress || 'Menyiapkan jawaban…'}</p>
          </article>
        )}
      </div>

      {(error || expandError) && (
        <div className="tf-chat-error" role="alert">
          {error || expandError}
          {!session && <button type="button" className="btn-secondary" onClick={chat.retry}>Coba lagi</button>}
        </div>
      )}
      <form className="tf-chat-composer" onSubmit={submit}>
        <label htmlFor={inputId}>Pertanyaan</label>
        <textarea id={inputId} ref={inputRef} rows={2} maxLength={500}
          value={draft} onChange={(event) => setDraft(event.target.value)}
          disabled={!session || busy} placeholder="Tulis pertanyaanmu…"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
        />
        <button type="submit" className="btn-primary" disabled={!session || busy || !draft.trim()}>Kirim</button>
      </form>
    </section>
  );
}
