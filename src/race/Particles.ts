export type Particle = {
  on: boolean; x: number; y: number; vx: number; vy: number;
  life: number; max: number; r: number; color: string; gravity: number;
  /**
   * A path particle has no screen-space velocity at all. It holds a position
   * in track coordinates and slides backwards along the road, so on a curve
   * the wake follows the road instead of shooting off the outside of the bend.
   * Whoever owns the geometry projects it back to pixels each frame.
   */
  path: boolean;
  cell: number;
  lateral: number;
  back: number;
  angle: number;
};

/** track coordinates -> screen, supplied by whoever owns the geometry */
export type Project = (cell: number, lateral: number) => {
  x: number; y: number; angle: number;
};

/**
 * Pooled canvas particles. Nothing is allocated per frame - a burst walks the
 * pool for a dead slot and gives up if the pool is full, which is the correct
 * behaviour under load: drop particles, never frames.
 */
export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;

  /**
   * Sized for the worst case, and then some. Seven cars gusting at once was
   * arithmetically over the old 560: 3 streaks per car per frame with a
   * ~17-frame life is ~360 alive from wind alone, and dust, trails and speed
   * lines took the rest. The pool ran dry mid-gust, the wind visibly stopped
   * and restarted as slots freed, and the booster flare - the most important
   * thing on screen - often never appeared at all.
   */
  constructor(size = 800) {
    for (let i = 0; i < size; i++) {
      this.pool.push({
        on: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, max: 1, r: 1, color: "#fff", gravity: 0.03,
        path: false, cell: 0, lateral: 0, back: 0, angle: 0,
      });
    }
  }

  /**
   * @param priority the flare may evict the faintest wind streak rather than
   * be dropped. Sizing the pool is the real fix, but a booster is a once-a-
   * game moment and must never lose a race for slots to ambient wind.
   */
  private take(priority = false): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.on) {
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        return p;
      }
    }
    if (!priority) return null;

    let victim: Particle | null = null;
    for (const p of this.pool) {
      if (!p.path) continue;                       // only ever evict wind
      if (!victim || p.life < victim.life) victim = p;
    }
    return victim;
  }

  /** kicked-up dust behind a running racer */
  dust(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      p.on = true;
      p.path = false;
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = -(0.6 + Math.random() * 2.4);
      p.vy = (Math.random() - 0.55) * 1.6;
      p.max = p.life = 22 + Math.random() * 20;
      p.r = 0.9 + Math.random() * 2;
      p.color = color;
      p.gravity = 0.03;
    }
  }

  /** thin horizontal streaks that read as speed */
  speedLine(x: number, y: number, color: string) {
    const p = this.take();
    if (!p) return;
    p.on = true;
    p.path = false;
    p.x = x; p.y = y + (Math.random() - 0.5) * 22;
    p.vx = -(5 + Math.random() * 5);
    p.vy = 0;
    p.max = p.life = 10 + Math.random() * 8;
    p.r = 1.1;
    p.color = color;
    p.gravity = 0;
  }

  /** a ghost left behind at speed - reads as a motion trail */
  trail(x: number, y: number, r: number, color: string) {
    const p = this.take();
    if (!p) return;
    p.on = true;
    p.path = false;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.max = p.life = 13;
    p.r = r;
    p.color = color;
    p.gravity = 0.001;
  }

  /**
   * A gust off the tail of a car that just won the round. It is laid down in
   * track coordinates and slides back down the road the car came along, so the
   * wake bends with the bend instead of flying straight off it.
   */
  wind(cell: number, lateral: number, n: number) {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      p.on = true;
      p.path = true;
      p.cell = cell - Math.random() * 0.5;
      p.lateral = lateral + (Math.random() - 0.5) * 22;
      p.back = 0.07 + Math.random() * 0.08;      // cells per frame, backwards
      p.max = p.life = 12 + Math.random() * 11;
      p.r = 0.9 + Math.random() * 1.3;
      p.color = "#dbe6ee";
      p.gravity = 0;
      p.angle = 0;
    }
  }

  /** Booster: a flare that erupts backwards and upwards, hot core first. */
  flame(x: number, y: number, angle: number, n: number) {
    const hues = ["#fff2c4", "#ffd24a", "#ff9d2e", "#f4562a", "#c22f1a"];
    for (let i = 0; i < n; i++) {
      const p = this.take(true);
      if (!p) return;
      const t = i / n;
      const spray = angle + Math.PI + (Math.random() - 0.5) * 1.1;
      const sp = 1.6 + Math.random() * 5.5;
      p.on = true;
      p.path = false;
      p.x = x; p.y = y;
      p.vx = Math.cos(spray) * sp;
      p.vy = Math.sin(spray) * sp - 1.4;
      p.max = p.life = 24 + Math.random() * 30;
      p.r = 2.1 + (1 - t) * 5.4;
      p.color = hues[Math.min(hues.length - 1, Math.floor(t * hues.length))];
      p.gravity = -0.05;              // heat rises
    }
  }

  burst(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3.4;
      p.on = true;
      p.path = false;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 1;
      p.max = p.life = 30 + Math.random() * 26;
      p.r = 1.5 + Math.random() * 2.6;
      p.color = color;
      p.gravity = 0.06;
    }
  }

  /**
   * Path streaks are bucketed by opacity and stroked in one pass per bucket.
   * A save/rotate/restore per particle cost 10-20fps during a dash, when a
   * hundred of them can be alive at once, and four alpha steps are not
   * distinguishable from a smooth fade at this size.
   */
  private static readonly ALPHA_STEPS = 4;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, project: Project) {
    ctx.clearRect(0, 0, w, h);

    const buckets: number[][] = [];
    for (let i = 0; i < Particles.ALPHA_STEPS; i++) buckets.push([]);

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.on) continue;

      if (p.path) {
        p.cell -= p.back;
        const q = project(p.cell, p.lateral);
        p.x = q.x;
        p.y = q.y;
        p.angle = q.angle;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.97;
      }
      p.life--;
      if (p.life <= 0) { p.on = false; continue; }

      const fade = Math.max(0, p.life / p.max);

      if (p.path) {
        const step = Math.min(
          Particles.ALPHA_STEPS - 1,
          Math.floor(fade * Particles.ALPHA_STEPS)
        );
        buckets[step].push(i);
        continue;
      }

      ctx.fillStyle = p.color;
      if (p.gravity === 0) {
        ctx.globalAlpha = fade * 0.85;
        ctx.fillRect(p.x, p.y, 26, p.r * 1.4);   // speed line
      } else {
        ctx.globalAlpha = fade * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.lineCap = "round";
    for (let step = 0; step < buckets.length; step++) {
      const ids = buckets[step];
      if (!ids.length) continue;
      ctx.globalAlpha = ((step + 0.5) / Particles.ALPHA_STEPS) * 0.6;
      ctx.strokeStyle = this.pool[ids[0]].color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const i of ids) {
        const p = this.pool[i];
        const dx = Math.cos(p.angle) * 13;
        const dy = Math.sin(p.angle) * 13;
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.on = false;
  }
}
