export function createOllama({ baseURL = 'http://127.0.0.1:11434', timeout = 120_000, fetcher = fetch } = {}) {
  const url = new URL(baseURL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('OLLAMA_HOST must be a loopback URL such as http://127.0.0.1:11434.');
  const base = url.origin;
  async function request(path, options = {}) {
    let response;
    try { response = await fetcher(`${base}${path}`, { ...options, signal: AbortSignal.timeout(timeout) }); }
    catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('Ollama took too long. Try a shorter prompt or a smaller model.');
      throw new Error('Cannot reach Ollama. Start Ollama, then try again.');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error('That model is unavailable in Ollama. Select an installed model.');
      throw new Error(`Ollama returned an error (${response.status}). Check that the selected model supports chat.`);
    }
    return response.json();
  }
  return {
    async models() {
      const data = await request('/api/tags');
      return (data.models || []).filter(m => !m.remote_host && !m.remote_model).map(m => m.name).filter(n => typeof n === 'string' && !n.includes(':cloud'));
    },
    async chat({ model, messages, json = false, maxTokens = 256 }) {
      const data = await request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false, think: false, keep_alive: '10m', ...(json ? { format: 'json' } : {}), options: { temperature: 0, num_predict: maxTokens, num_ctx: 4096 } }) });
      // Reasoning is deliberately never returned to the browser or used as an answer.
      return typeof data.message?.content === 'string' ? data.message.content : '';
    },
  };
}
