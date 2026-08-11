// The buzz loop, as a transport-agnostic session.
//
// The same object drives the simulator and the live staging path; only the
// speech transport differs. Everything that decides a score lives here.

import { OffsetLedger } from './offsetLedger.js';
import { getInterruptShape, canScoreInterruption } from './interruptShape.js';
import { buildRound, CLUES_PER_ROUND } from './challenge.js';
import {
  OUTCOME, scoreBuzz, scoreSession, answerMatches, buildWordStrip, countWords,
} from './scoring.js';

export class GameSession {
  constructor({ seed = 1, clueCount = CLUES_PER_ROUND, shape, sampleRate = 48000 } = {}) {
    this.shape = shape || getInterruptShape();
    if (!canScoreInterruption(this.shape)) {
      throw new Error(
        `Interrupt shape "${this.shape.name}" cannot report what was left unsaid, ` +
          'so a buzz cannot be scored honestly. Refusing to start a round.'
      );
    }
    const round = buildRound(seed, clueCount);
    this.seed = round.seed;
    this.voice = round.voice;
    this.clues = round.clues;
    // ONE ledger for the whole session. Not one per clue. See PRD 5.1.
    this.ledger = new OffsetLedger({ sampleRate });
    this.results = [];
    this.index = 0;
  }

  get currentClue() {
    return this.clues[this.index] || null;
  }

  get finished() {
    return this.index >= this.clues.length;
  }

  // Build the client-side Interrupt message for a confirmed buzz. The offset
  // comes from the ledger's held onset capture, never from a fresh read.
  buildInterruptMessage({ speechId } = {}) {
    const offsetMs = this.ledger.offsetForConfirmedBuzz();
    return { message: this.shape.buildInterrupt({ offsetMs, speechId }), offsetMs };
  }

  // Resolve one clue from the server's report plus the player's answer.
  resolve({ report, answer }) {
    const clue = this.currentClue;
    if (!clue) throw new Error('No clue in play.');

    if (!report) {
      const result = {
        clueId: clue.id, kind: clue.kind, outcome: OUTCOME.NO_BUZZ,
        points: 0, wordsUnsaid: 0, textSpoken: clue.text, textRemaining: '',
        strip: buildWordStrip(clue.text, clue.text),
      };
      this.results.push(result);
      this.index += 1;
      return result;
    }

    const correct = answerMatches(answer, clue.accept);
    const outcome = correct ? OUTCOME.CORRECT : OUTCOME.WRONG;
    const scored = scoreBuzz({ textRemaining: report.textRemaining, outcome });

    const result = {
      clueId: clue.id,
      kind: clue.kind,
      outcome,
      points: scored.points,
      wordsUnsaid: scored.wordsUnsaid,
      textSpoken: report.textSpoken,
      textRemaining: report.textRemaining,
      wordsHeard: countWords(report.textSpoken),
      strip: buildWordStrip(clue.text, report.textSpoken),
    };
    this.results.push(result);
    this.index += 1;
    return result;
  }

  total() {
    return scoreSession(this.results);
  }
}
