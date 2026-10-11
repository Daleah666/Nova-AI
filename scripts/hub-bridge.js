// Local stand-in for the Chrome extension bridge and for window.claude.
// npm run dev injects this into the Hub page. It is not part of hub/, so a Claude sync cannot wipe it.
// The page still works with no keys: chat explains what is missing, and the relay stays on this computer.
(function () {
  const ORIGIN_POST = window.postMessage.bind(window);
  // App links call preventDefault and then postMessage. Open the tab in that same click,
  // because a later message handler is no longer counted as a user click.
  window.postMessage = function (msg, target, transfer) {
    try {
      if (msg && msg.source === 'the-hub-page' && msg.type === 'open' && /^https?:\/\//i.test(String(msg.url || ''))) {
        window.open(msg.url, '_blank', 'noopener');
      }
    } catch (e) {}
    return ORIGIN_POST(msg, target, transfer);
  };

  const post = (type, payload) => ORIGIN_POST({ source: 'the-hub-extension', type, payload }, '*');
  let sawHello = false;
  let activityTimer = null;

  async function devPost(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !j.error) j.error = 'The local Hub server returned ' + r.status + '.';
    return j;
  }

  async function sendActivity() {
    try {
      const r = await fetch('/__dev/activity', { cache: 'no-store' });
      const j = await r.json();
      post('activity', j);
    } catch (e) {}
  }

  let extVersion = '';
  async function announce() {
    if (sawHello) return;
    if (!extVersion) {
      try {
        const r = await fetch('/__dev/status', { cache: 'no-store' });
        const j = await r.json();
        if (j && typeof j.extensionVersion === 'string' && j.extensionVersion) extVersion = j.extensionVersion;
      } catch (e) {}
    }
    post('present', { version: extVersion || '1.6.1', caps: ['grok', 'relay', 'keys'] });
  }

  function paired() {
    sawHello = true;
    post('paired');
    sendActivity();
    if (!activityTimer) activityTimer = setInterval(sendActivity, 60000);
  }

  function cancelled(signal) {
    if (!signal || !signal.aborted) return false;
    const err = new Error('cancelled');
    err.code = 'cancelled';
    throw err;
  }

  async function blobPart(blob) {
    const type = /^image\/(png|jpeg|gif|webp)$/.test(blob.type || '') ? blob.type : 'image/png';
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) throw new Error('That picture is too big to send to Claude.');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { type: 'image', source: { type: 'base64', media_type: type, data: btoa(bin) } };
  }

  async function withImages(messages, images) {
    if (!images || !images.length) return messages;
    const copy = messages.map((m) => ({ role: m.role, content: m.content }));
    let last = -1;
    for (let i = 0; i < copy.length; i++) if (copy[i].role === 'user' && typeof copy[i].content === 'string') last = i;
    if (last < 0) return copy;
    const parts = [{ type: 'text', text: copy[last].content }];
    for (const blob of images.slice(0, 4)) {
      if (blob) parts.push(await blobPart(blob));
    }
    copy[last] = { role: 'user', content: parts };
    return copy;
  }

  async function runSample(input, opts) {
    opts = opts || {};
    cancelled(opts.signal);
    let messages = typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : (Array.isArray(input) ? input.map((m) => ({ role: m.role, content: m.content })) : null);
    if (!messages) throw Object.assign(new Error('Bad prompt'), { text: 'Bad prompt' });
    messages = await withImages(messages, opts.images);
    const tools = Array.isArray(opts.tools) ? opts.tools : [];
    const schemas = tools.map((t) => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || { type: 'object', properties: {} },
    }));
    let text = '';
    let truncated = false;
    for (let round = 0; round < 6; round++) {
      cancelled(opts.signal);
      const j = await devPost('/__dev/claude', { messages, tools: schemas, modelTier: opts.modelTier || 'default' });
      if (j.missing) {
        text = j.text || 'Claude is not connected on this computer yet.';
        break;
      }
      if (j.ok === false || j.error) {
        const err = new Error(j.error || 'Claude did not answer.');
        err.text = err.message;
        throw err;
      }
      const uses = Array.isArray(j.toolUses) ? j.toolUses : [];
      if (!uses.length) {
        text = j.text || '';
        truncated = !!j.truncated;
        break;
      }
      messages.push({ role: 'assistant', content: j.content });
      const results = [];
      for (const tu of uses) {
        const tool = tools.find((t) => t.name === tu.name);
        let content = '';
        let isError = false;
        try {
          if (!tool || typeof tool.execute !== 'function') throw new Error('Unknown tool ' + tu.name);
          const out = await tool.execute(tu.input || {}, { signal: opts.signal });
          content = typeof out === 'string' ? out : JSON.stringify(out);
        } catch (e) {
          isError = true;
          content = (e && e.message) || String(e);
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: String(content).slice(0, 24000), is_error: isError });
      }
      messages.push({ role: 'user', content: results });
      if (j.text) text = j.text;
    }
    if (opts.onText) { try { opts.onText({ text }); } catch (e) {} }
    return truncated ? { text, truncated: true } : { text };
  }

  async function sampleJson(input, opts) {
    const r = await runSample(input, opts);
    const text = String(r.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(text); }
    catch (e) {
      const err = new Error('The answer came back in the wrong shape.');
      err.code = 'invalid_json';
      err.text = text;
      throw err;
    }
  }

  async function limits() {
    try {
      const r = await fetch('/__dev/status', { cache: 'no-store' });
      const j = await r.json();
      return { tools: !!j.claude, images: !!j.claude };
    } catch (e) {
      return { tools: false, images: false };
    }
  }

  const sample = function (input, opts) { return runSample(input, opts); };
  sample.json = sampleJson;
  sample.limits = limits;

  window.claude = window.claude || {};
  const previousUse = window.claude.use;
  window.claude.use = function (name) {
    if (name === 'sample') return Promise.resolve(sample);
    if (typeof previousUse === 'function') return previousUse(name);
    return Promise.resolve(null);
  };

  async function onCall(d) {
    const a = d.args || {};
    if (d.op === 'relayCall') return devPost('/__dev/relay', { op: a.op, args: a.args || {}, ms: a.ms });
    if (d.op === 'relayStatus') return devPost('/__dev/relay', { op: '__status' });
    if (d.op === 'relayCodeSet') return devPost('/__dev/relay', { op: '__codeSet', code: a.code });
    if (d.op === 'relayCodeClear') return devPost('/__dev/relay', { op: '__codeClear' });
    if (d.op === 'grokKeyStatus' || d.op === 'grokKeyClear' || d.op === 'grokKeyTest') return devPost('/__dev/grok', { op: d.op });
    if (d.op === 'grokKeySet') return devPost('/__dev/grok', { op: d.op, key: a.key });
    if (d.op === 'grokImage') return devPost('/__dev/grok', { op: d.op, mode: a.mode, prompt: a.prompt, n: a.n, aspect: a.aspect, model: a.model, image: a.image });
    if (d.op === 'keyStatus') return devPost('/__dev/keys', { op: 'status' });
    if (d.op === 'keySet') return devPost('/__dev/keys', { op: 'set', provider: a.provider, key: a.key });
    if (d.op === 'keyClear') return devPost('/__dev/keys', { op: 'clear', provider: a.provider });
    if (d.op === 'keyTest') return devPost('/__dev/keys', { op: 'test', provider: a.provider });
    if (d.op === 'openExtDetails') return { error: 'This local server is not the Chrome extension, so it cannot open chrome://extensions.' };
    return { error: 'The local Hub server does not do that. The Chrome extension does.' };
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'the-hub-page') return;
    if (d.type === 'hello' || d.type === 'request') { paired(); return; }
    if (d.type === 'call' && typeof d.reqId === 'string') {
      let result;
      try { result = await onCall(d); }
      catch (err) { result = { error: (err && err.message) || 'failed' }; }
      post('reply', { reqId: d.reqId, result });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce);
  else announce();
  setTimeout(announce, 800);
  setTimeout(announce, 2000);
})();
