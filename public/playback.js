// Device-measured playback position.
//
// The offset is measured at the audio device — samples actually rendered by
// the output worklet — never with a wall clock. A wall clock overcounts by
// including buffered-but-unheard audio and silent underruns: tens of units on
// a good connection, hundreds on a bad one, always in the direction of telling
// the player they heard more than they did.
//
// scripts/check-offset.js asserts that nothing in this file reads a clock.
// See PRD 5.1 — this is one of the three decisions not open for revisiting.

const WORKLET_SOURCE = `
class RenderCounter extends AudioWorkletProcessor {
  constructor() {
    super();
    this._rendered = 0;
    this._queue = [];
    this._reported = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'push') this._queue.push(e.data.samples);
      if (e.data && e.data.type === 'flush') this._queue.length = 0;
    };
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    let written = 0;

    while (written < out.length && this._queue.length) {
      const chunk = this._queue[0];
      const take = Math.min(chunk.length, out.length - written);
      out.set(chunk.subarray(0, take), written);
      written += take;
      if (take === chunk.length) this._queue.shift();
      else this._queue[0] = chunk.subarray(take);
    }

    // Only frames we actually filled with audio count as rendered. Silent
    // underrun frames are NOT counted — that is the whole point.
    if (written > 0) {
      this._rendered += written;
      // Report at most every ~5ms of rendered audio to keep the port quiet.
      if (this._rendered - this._reported >= 256) {
        this._reported = this._rendered;
        this.port.postMessage({ type: 'rendered', frames: this._rendered });
      }
    }
    return true;
  }
}
registerProcessor('render-counter', RenderCounter);
`;

export class DevicePlayback {
  constructor({ ledger, ctx }) {
    this.ledger = ledger;
    this.ctx = ctx;
    this.node = null;
    this._lastReported = 0;
  }

  async start() {
    const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.node = new AudioWorkletNode(this.ctx, 'render-counter', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });

    this.node.port.onmessage = (e) => {
      if (e.data?.type !== 'rendered') return;
      // The worklet reports a cumulative total; feed the ledger the delta so
      // the ledger stays the single monotonic counter for the session.
      const delta = e.data.frames - this._lastReported;
      this._lastReported = e.data.frames;
      if (delta > 0) this.ledger.recordRenderedSamples(delta);
    };

    this.node.connect(this.ctx.destination);
  }

  // Hand decoded audio to the device. Enqueued is not rendered; only the
  // worklet's report advances the ledger.
  push(samples) {
    this.node?.port.postMessage({ type: 'push', samples }, [samples.buffer]);
  }

  // Cut playback at a confirmed buzz. Anything still queued was never heard,
  // so it must never count toward the offset.
  flush() {
    this.node?.port.postMessage({ type: 'flush' });
  }

  stop() {
    this.flush();
    try { this.node?.disconnect(); } catch { /* already gone */ }
    this.node = null;
  }
}
