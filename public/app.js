const $ = id => document.getElementById(id);
let state, level = 1, busy = false, online = false, resetModel = null;
const conversations = new Map();
let artwork = {};

async function api(path, data) {
  const response = await fetch(`/api/${path}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result;
}
function showError(message = '') { $('error').textContent = message; $('error').hidden = !message; }
function setBusy(value) {
  busy = value;
  for (const id of ['ask', 'check', 'restart', 'model', 'reconnect', 'next-level']) $(id).disabled = value || (!online && ['ask', 'check'].includes(id));
  $('prompt').disabled = value || !online;
  $('guess').disabled = value || !online;
  $('busy-note').hidden = !value;
  $('ask').textContent = value ? 'Thinking…' : 'Send';
  document.querySelectorAll('.level-nav button').forEach(button => { button.disabled = value || Number(button.dataset.level) > (state?.unlocked || 0); });
}
function addMessage(role, text, blocked = false) {
  if (!conversations.has(level)) conversations.set(level, []);
  conversations.get(level).push({ role, text, blocked });
  renderConversation();
}
function renderConversation() {
  const container = $('conversation'); container.replaceChildren();
  const latest = (conversations.get(level) || []).filter(message => message.role === 'wizard').at(-1);
  container.hidden = !latest;
  $('guess-section').hidden = !latest && !state?.completed.includes(level);
  if (!latest) return;
  const block = document.createElement('div');
  block.className = `message ${latest.blocked ? 'blocked' : ''}`;
  block.textContent = latest.text;
  container.append(block);
}

function render() {
  if (!state) return;
  const current = state.levels[level - 1];
  $('level-label').textContent = `(LVL ${level})`;
  $('passed-count').textContent = `${state.completed.length} / 7`;
  $('wizard-art').src = artwork[String(level)] || '/wizard.svg';
  $('wizard-art').alt = `Gandalf at level ${level}`;
  $('level-title').textContent = current.title;
  $('level-description').textContent = current.description;
  $('defense').textContent = current.defense;
  $('hint-text').textContent = current.hint;
  const n = state.attempts[level - 1]; $('attempts').textContent = `${n} ${n === 1 ? 'attempt' : 'attempts'}`;
  $('level-nav').replaceChildren();
  for (const item of state.levels) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.level = item.id;
    button.className = state.completed.includes(item.id) ? 'completed' : '';
    button.textContent = state.completed.includes(item.id) && level !== item.id ? '✓' : String(item.id);
    button.setAttribute('aria-label', `Level ${item.id}: ${item.title}${state.completed.includes(item.id) ? ', completed' : ''}`);
    if (level === item.id) button.setAttribute('aria-current', 'step');
    button.disabled = busy || item.id > state.unlocked;
    button.addEventListener('click', () => chooseLevel(item.id)); $('level-nav').append(button);
  }
  const completed = state.completed.includes(level);
  $('success').hidden = !completed;
  if (completed) {
    $('success-title').textContent = state.completed.length === 7 ? 'You found every word.' : 'The tower opens.';
    $('lesson').textContent = current.lesson;
    $('next-level').textContent = level === 7 ? 'Play again ↻' : 'Next level →';
  }
  renderConversation(); setBusy(busy);
}
function chooseLevel(value) {
  if (busy || value > state.unlocked) return;
  level = value; $('guess').value = ''; $('prompt').value = ''; $('guess-result').textContent = ''; showError(); render(); $('prompt').focus();
}
async function connect() {
  showError();
  try {
    if (!Object.keys(artwork).length) { const assets = await fetch('/artwork/manifest.json'); if (assets.ok) artwork = await assets.json(); }
    const health = await api('health'); online = health.connected && health.models.length > 0;
    $('connection').classList.toggle('offline', !online);
    $('connection').replaceChildren(); const dot = document.createElement('i'); $('connection').append(dot, document.createTextNode(online ? 'Ollama connected' : 'Ollama needs attention'));
    $('model').replaceChildren();
    for (const name of health.models) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('model').append(option); }
    if (!online) {
      showError(health.connected ? 'Ollama is running, but no local model is installed. In Terminal, run “ollama pull llama3.2:3b”, then check the connection again below.' : (health.error || 'Start Ollama, then check the connection again below.'));
      setBusy(false); return;
    }
    state = await api('state');
    $('model').value = state.model;
    level = Math.min(level === 1 ? state.unlocked : level, state.unlocked);
    render();
  } catch (error) { online = false; showError(error.message); setBusy(false); }
}
$('prompt-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !state || !online) return;
  const prompt = $('prompt').value.trim(); if (!prompt) return;
  showError(); setBusy(true); conversations.set(level, []); addMessage('player', prompt);
  try {
    const response = await api('attack', { level, prompt }); state = response.state;
    addMessage('wizard', response.answer, response.blocked);
  } catch (error) { showError(error.message); }
  finally { setBusy(false); render(); $('prompt').focus(); }
});
$('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('prompt-form').requestSubmit(); } });
$('guess-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !state || !online) return;
  const value = $('guess').value.trim(); if (!value) return;
  showError(); setBusy(true);
  try {
    const response = await api('guess', { level, guess: value }); state = response.state;
    $('guess-result').textContent = response.success ? '' : 'Not quite. Try another question or check your spelling.';
    render();
    if (response.success) { $('success').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('next-level').focus(); }
  } catch (error) { showError(error.message); }
  finally { setBusy(false); }
});
function askReset(model = state?.model) { if (busy) return; resetModel = model; $('reset-dialog').showModal(); }
$('restart').addEventListener('click', () => askReset());
$('model').addEventListener('change', () => { const model = $('model').value; if (state) $('model').value = state.model; askReset(model); });
$('reset-dialog').addEventListener('close', async () => {
  if ($('reset-dialog').returnValue !== 'reset') return;
  showError(); setBusy(true);
  try { state = await api('reset', { model: resetModel }); level = 1; conversations.clear(); $('guess').value = ''; $('prompt').value = ''; $('guess-result').textContent = ''; $('model').value = state.model; render(); }
  catch (error) { showError(error.message); }
  finally { setBusy(false); $('prompt').focus(); }
});
$('next-level').addEventListener('click', () => level === 7 ? askReset() : chooseLevel(level + 1));
$('reconnect').addEventListener('click', connect);
setBusy(false); connect();
