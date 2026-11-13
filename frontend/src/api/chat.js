const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request(path, method = 'GET', payload, signal) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    signal,
    ...(payload === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Permintaan asisten gagal (HTTP ${response.status}).`);
  }
  return response;
}

async function json(path, method, payload) {
  const response = await request(path, method, payload);
  return response.status === 204 ? null : response.json();
}

const sessions = '/chat/sessions';
const sessionPath = (id) => `${sessions}/${encodeURIComponent(id)}`;

export const listAnalyses = () => json('/analyses');
export const listChatSessions = () => json(sessions);
export const getChatSession = (id) => json(sessionPath(id));
export const createChatSession = (payload) => json(sessions, 'POST', payload);
export const patchChatSession = (id, payload) => json(sessionPath(id), 'PATCH', payload);
export const deleteChatSession = (id) => json(sessionPath(id), 'DELETE');

export async function streamChatMessage(id, content, { signal, onEvent }) {
  const response = await request(`${sessionPath(id)}/messages`, 'POST', { content }, signal);
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
    throw new Error('Server tidak mengirim aliran jawaban.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function dispatch(block) {
    const lines = block.split(/\r?\n/);
    const name = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim());
    if (name && data.length) onEvent(name, JSON.parse(data.join('\n')));
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop();
      blocks.forEach(dispatch);
      if (done) {
        if (buffer.trim()) dispatch(buffer);
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
