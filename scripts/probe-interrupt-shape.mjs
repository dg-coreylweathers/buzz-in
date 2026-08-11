import WebSocket from 'ws';
const KEY = process.env.DEEPGRAM_STAGING_API_KEY;
const URL = 'wss://api.staging.deepgram.com/v2/speak?model=flux-rufus-en&encoding=linear16&sample_rate=48000';

const VARIANTS = [
  { label: 'Interrupt + playback_offset_ms', msg: (id) => ({ type: 'Interrupt', playback_offset_ms: 800 }) },
  { label: 'Interrupt bare',                 msg: (id) => ({ type: 'Interrupt' }) },
  { label: 'Interrupt + speech_id',          msg: (id) => ({ type: 'Interrupt', speech_id: id }) },
  { label: 'Interrupt + speech_id + offset', msg: (id) => ({ type: 'Interrupt', speech_id: id, playback_offset_ms: 800 }) },
  { label: 'Interrupt + playback_offset',    msg: (id) => ({ type: 'Interrupt', playback_offset: 800 }) },
  { label: 'Interrupt + offset_ms',          msg: (id) => ({ type: 'Interrupt', offset_ms: 800 }) },
  { label: 'Clear',                          msg: (id) => ({ type: 'Clear' }) },
];

function tryVariant(v) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL, { headers: { Authorization: `Token ${KEY}` } });
    let speechId = null, result = [], settled = false;
    const finish = (verdict) => { if (settled) return; settled = true; try { ws.close(); } catch {} resolve({ label: v.label, verdict, result }); };
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'Speak', text: 'This river runs through ten countries and is the longest in its continent by a wide margin.' }));
      ws.send(JSON.stringify({ type: 'Flush' }));
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const m = JSON.parse(data.toString());
      if (m.type === 'SpeechStarted') {
        speechId = m.speech_id;
        setTimeout(() => ws.send(JSON.stringify(v.msg(speechId))), 900);
      }
      if (m.type === 'Error') { result.push(m); finish('REJECTED: ' + m.code); }
      if (m.type === 'SpeechInterrupted' || m.type === 'Cleared' || m.type === 'Warning') { result.push(m); finish('ACCEPTED -> ' + m.type); }
    });
    ws.on('error', (e) => finish('ws error: ' + e.message));
    ws.on('close', () => finish('closed with no verdict'));
    setTimeout(() => finish('no reply within 4s'), 4500);
  });
}

for (const v of VARIANTS) {
  const r = await tryVariant(v);
  console.log(`${r.verdict.padEnd(34)} ${r.label}`);
  r.result.forEach((m) => console.log('      ', JSON.stringify(m).slice(0, 260)));
}
process.exit(0);
