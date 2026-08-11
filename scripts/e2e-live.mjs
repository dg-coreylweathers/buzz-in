// Exercises exactly what the browser does: connect to OUR server, receive
// audio, buzz, read the report. No key on this side of the connection.
import WebSocket from 'ws';
import { OffsetLedger } from './src/offsetLedger.js';
import { getInterruptShape } from './src/interruptShape.js';

const shape = getInterruptShape('staging');
const ledger = new OffsetLedger({ sampleRate: 48000 });
const ws = new WebSocket('ws://localhost:8080/speak');
const CLUE = 'This river runs through ten countries and is the longest in its continent by a wide margin.';
let bytes = 0, started = null, buzzed = false;

ws.on('open', () => {
  console.log('connected to OUR server (no key on this side)');
  ws.send(JSON.stringify({ type: 'start', voice: 'rufus', text: CLUE }));
});

ws.on('message', (data, isBinary) => {
  if (isBinary) {
    bytes += data.length;
    // Stand in for the output worklet: these frames were "rendered".
    ledger.recordRenderedSamples(data.length / 2);
    if (!buzzed && ledger.currentOffsetMs() >= 900) {
      buzzed = true;
      const held = ledger.captureAtOnset();           // onset capture
      console.log(`BUZZ — offset held at onset: ${held.toFixed(0)}`);
      ws.send(JSON.stringify({ type: 'interrupt' }));
    }
    return;
  }
  const m = JSON.parse(data.toString());
  if (m.type === 'Connected') console.log('staging session up:', m.model_name, m.model_version);
  if (m.type === 'SpeechStarted') { started = m.speech_id; console.log('SpeechStarted', m.speech_id); }
  if (m.type === 'SpeechInterrupted') {
    const report = shape.parseReport(m);
    const confirmed = ledger.offsetForConfirmedBuzz();  // uses the HELD value
    console.log('\n=== RESULT ===');
    console.log('audio received      :', bytes, 'bytes =', (bytes/2/48000*1000).toFixed(0), 'ms rendered');
    console.log('offset used (onset) :', confirmed.toFixed(0));
    console.log('server audio_played :', report.audioPlayedMs);
    console.log('server speech_id    :', report.speechId);
    console.log('text_spoken         :', JSON.stringify(report.textSpoken), '<- server did not report');
    console.log('text_remaining      :', JSON.stringify(report.textRemaining), '<- server did not report');
    ws.send(JSON.stringify({ type: 'stop' }));
    setTimeout(() => process.exit(0), 200);
  }
  if (m.type === 'ProxyError') { console.log('PROXY ERROR:', m.reason); process.exit(1); }
});
ws.on('error', e => { console.log('error', e.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 15000);
