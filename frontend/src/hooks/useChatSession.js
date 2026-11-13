import { useEffect, useRef, useState } from 'react';
import { createChatSession, getChatSession, patchChatSession, streamChatMessage } from '../api/chat.js';

export function useChatSession({ result, sessionId, onSessionChange }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const initialResult = useRef(result);
  const sessionRequest = useRef(null);
  const currentRequest = useRef(null);
  const syncedResult = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const request = sessionRequest.current ??= sessionId
      ? getChatSession(sessionId)
      : createChatSession({ result: initialResult.current, origin: 'analysis' });
    request.then((next) => {
      if (active) setSession(next);
    }).catch((err) => {
      if (active) {
        sessionRequest.current = null;
        setError(err.message);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionId, retryCount]);

  useEffect(() => {
    if (!session?.pending || sending) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const next = await getChatSession(session.id);
        if (active) setSession(next);
      } catch {}
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.id, session?.pending, sending]);

  useEffect(() => () => currentRequest.current?.abort(), []);

  async function syncReport() {
    if (!session?.id || !result || syncedResult.current === result) return;
    const snapshot = session.snapshot;
    if (snapshot && ['entity', 'fields', 'validation', 'metrics', 'tiering', 'market', 'valuation']
      .every((key) => JSON.stringify(snapshot[key]) === JSON.stringify(result[key]))) {
      syncedResult.current = result;
      return;
    }
    const next = await patchChatSession(session.id, { result });
    syncedResult.current = result;
    setSession(next);
  }

  async function send(content) {
    if (!session?.id || session.pending || currentRequest.current) return false;
    const controller = new AbortController();
    currentRequest.current = controller;
    setSending(true);
    setProgress('');
    setError(null);
    const sessionKey = session.id;
    const pendingMessage = { id: 'pending-question', role: 'user', content };

    try {
      await syncReport();
      if (controller.signal.aborted) return false;
      setSession((current) => ({ ...current, messages: [...(current.messages ?? []), pendingMessage] }));
      let finalMessage;
      let sendError;
      await streamChatMessage(sessionKey, content, {
        signal: controller.signal,
        onEvent(name, data) {
          if (name === 'sentence' && data.text) {
            setProgress((previous) => [previous, data.text].filter(Boolean).join(' '));
          } else if (name === 'done') {
            finalMessage = data.message;
          } else if (name === 'busy') {
            sendError = 'Asisten sedang menjawab pertanyaan lain. Coba lagi sebentar.';
          } else if (name === 'error') {
            sendError = data.error || 'Gagal mendapatkan jawaban.';
          }
        },
      });
      if (finalMessage) {
        setSession((current) => ({ ...current, messages: [...current.messages, finalMessage] }));
        setProgress('');
      }
      if (sendError) throw new Error(sendError);
      if (!finalMessage) throw new Error('Aliran jawaban berhenti sebelum selesai.');
      onSessionChange?.();
      return true;
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
      return false;
    } finally {
      if (!controller.signal.aborted) {
        try {
          const next = await getChatSession(sessionKey);
          if (!controller.signal.aborted) setSession(next);
        } catch {
          if (!controller.signal.aborted) {
            setSession((current) => {
              const messages = current.messages ?? [];
              return messages.some(({ id }) => id === pendingMessage.id) && messages.at(-1)?.role === 'user'
                ? { ...current, messages: messages.filter(({ id }) => id !== pendingMessage.id) }
                : current;
            });
          }
        }
        if (!controller.signal.aborted) {
          setProgress('');
          setSending(false);
        }
      }
      if (currentRequest.current === controller) currentRequest.current = null;
    }
  }

  return { session, loading, sending, progress, error, send, syncReport, retry: () => setRetryCount((n) => n + 1) };
}
