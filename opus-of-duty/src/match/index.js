/**
 * MATCH: the Team Deathmatch loop around the sandbox.
 *
 * Without it the game had no rules: the clock sat at 10:00, a player death
 * scored nothing, and the garrison spawned once, so the map went empty after
 * six kills. This system owns exactly that loop and nothing else:
 *
 *   - the match clock, pushed to the HUD through `ui.setMatch`
 *   - the enemy score (+1 on every `player:death`); our score stays where the
 *     HUD already credits it, on confirmed kills
 *   - enemy reinforcements: dead bodies are cleared after CORPSE_TIME, and the
 *     live count is topped back up to the starting garrison in small waves, at
 *     spawn points far from the player
 *   - end of match at the score limit or when the clock runs out: a results
 *     screen, then a fresh match
 *
 * Capture runs (`config.deterministic`) keep the clock and reinforcements off
 * so screenshots stay reproducible.
 */

const MATCH_SECONDS = 600;
const SCORE_LIMIT = 50;
const CORPSE_TIME = 12; // s a body stays down before it is cleared
const REINFORCE_EVERY = 6; // s between reinforcement checks
const RESULTS_TIME = 8; // s on the results screen

export class MatchSystem {
  static id = 'match';
  static deps = ['ai', 'ui', 'player'];

  async init(ctx) {
    this.ctx = ctx;
    this.enabled = !ctx.config.deterministic;
    this.timeLeft = MATCH_SECONDS;
    this.scoreThem = 0;
    this._reinforceT = REINFORCE_EVERY;
    this._garrison = 0;
    this._over = false;
    this._resultsT = 0;
    this._off = [ctx.events.on('player:death', () => this._onPlayerDeath())];

    this._screen = document.createElement('div');
    this._screen.className = 'ow-match-end';
    this._screen.hidden = true;
    this._screen.innerHTML =
      '<div class="ow-match-end-title"></div><div class="ow-match-end-score"></div><div class="ow-match-end-sub"></div>';
    const s = this._screen.style;
    Object.assign(s, {
      position: 'fixed', inset: '0', zIndex: '40', display: 'none', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '10px',
      background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,.55), rgba(0,0,0,.88))',
      color: '#e9e4df', fontFamily: '"Helvetica Neue", Arial, sans-serif', textAlign: 'center',
      pointerEvents: 'none',
    });
    document.body.appendChild(this._screen);
    this._push();
  }

  _onPlayerDeath() {
    if (!this.enabled || this._over) return;
    this.scoreThem++;
    this._push();
    if (this.scoreThem >= SCORE_LIMIT) this._end();
  }

  _push() {
    this.ctx.peek('ui')?.setMatch?.({ timeLeft: Math.max(0, this.timeLeft), scoreThem: this.scoreThem });
  }

  update(dt, ctx) {
    if (!this.enabled) return;
    const ai = ctx.peek('ai');
    if (!this._garrison && ai?.agents?.length) this._garrison = ai.agents.filter((a) => a.alive).length;

    if (this._over) {
      this._resultsT -= dt;
      this._screen.querySelector('.ow-match-end-sub').textContent =
        `Nova partida em ${Math.max(1, Math.ceil(this._resultsT))}`;
      if (this._resultsT <= 0) this._restart();
      return;
    }

    this.timeLeft -= dt;
    this._push();
    const us = ctx.peek('ui')?.state?.scoreUs ?? 0;
    if (this.timeLeft <= 0 || us >= SCORE_LIMIT) {
      this._end();
      return;
    }

    if (ai) this._maintainGarrison(ai, dt);
  }

  /** Clear old bodies and top the live count back up, a few at a time. */
  _maintainGarrison(ai, dt) {
    const agents = ai.agents;
    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i];
      if (!a.alive && (a.deadTime ?? 0) > CORPSE_TIME) {
        a.dispose();
        agents.splice(i, 1);
      }
    }
    this._reinforceT -= dt;
    if (this._reinforceT > 0 || !this._garrison) return;
    this._reinforceT = REINFORCE_EVERY;
    const alive = agents.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
    const missing = this._garrison - alive;
    // Waves of up to three, so a wiped garrison refills over a few seconds
    // instead of materialising all at once.
    if (missing > 0) ai.populate({ squads: 1, perSquad: Math.min(3, missing) });
  }

  _end() {
    this._over = true;
    this._resultsT = RESULTS_TIME;
    const us = this.ctx.peek('ui')?.state?.scoreUs ?? 0;
    const them = this.scoreThem;
    this._screen.querySelector('.ow-match-end-title').textContent =
      us > them ? 'VITÓRIA' : us < them ? 'DERROTA' : 'EMPATE';
    this._screen.querySelector('.ow-match-end-score').textContent = `${us}  —  ${them}`;
    const t = this._screen.querySelector('.ow-match-end-title').style;
    Object.assign(t, { fontWeight: '700', fontSize: '52px', letterSpacing: '.14em' });
    Object.assign(this._screen.querySelector('.ow-match-end-score').style, {
      fontSize: '30px', letterSpacing: '.1em', fontVariantNumeric: 'tabular-nums',
    });
    Object.assign(this._screen.querySelector('.ow-match-end-sub').style, {
      fontSize: '15px', letterSpacing: '.08em', textTransform: 'uppercase', color: '#b9b3ad',
    });
    this._screen.hidden = false;
    this._screen.style.display = 'flex';
    const p = this.ctx.peek('player');
    if (p?.movement) p.movement.controlEnabled = false;
  }

  _restart() {
    this._over = false;
    this._screen.hidden = true;
    this._screen.style.display = 'none';
    this.timeLeft = MATCH_SECONDS;
    this.scoreThem = 0;
    const ui = this.ctx.peek('ui');
    ui?.setMatch?.({ scoreUs: 0, scoreThem: 0, timeLeft: MATCH_SECONDS });
    const p = this.ctx.peek('player');
    if (p) {
      p._respawnAfterDeath?.();
      if (p.movement) p.movement.controlEnabled = p.controlEnabled;
    }
    this._reinforceT = 0;
  }

  dispose() {
    for (const off of this._off) off();
    this._screen.remove();
  }
}
