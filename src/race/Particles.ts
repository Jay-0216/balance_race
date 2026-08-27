export type Particle = {
  on: boolean; x: number; y: number; vx: number; vy: number;
  life: number; max: number; r: number; color: string; gravity: number;
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
   * Sized for the worst case: seven cars gusting at once will happily eat a
   * small pool, and the booster flare - which fires in the same frame and is
   * the most important thing on screen - was losing the race for slots.
   */
  constructor(size = 560) {
    for (let i = 0; i < size; i++) {
      this.pool.push({
        on: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, max: 1, r: 1, color: "#fff", gravity: 0.03,
      });
    }
  }

  private take(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.on) {
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        return p;
      }
    }
    return null;
  }

  /** kicked-up dust behind a running racer */
  dust(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      p.on = true;
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
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.max = p.life = 13;
    p.r = r;
    p.color = color;
    p.gravity = 0.001;
  }

  /**
   * A gust behind a car that just won the round: long, fast, fading streaks
   * that read as the air being shoved out of the way.
   */
  wind(x: number, y: number, angle: number, n: number) {
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      const spread = (Math.random() - 0.5) * 26;
      p.on = true;
      p.x = x - Math.cos(angle) * Math.random() * 16 - Math.sin(angle) * spread;
      p.y = y - Math.sin(angle) * Math.random() * 16 + Math.cos(angle) * spread;
      const sp = 6 + Math.random() * 7;
      p.vx = -Math.cos(angle) * sp;
      p.vy = -Math.sin(angle) * sp;
      p.max = p.life = 10 + Math.random() * 9;
      p.r = 0.9 + Math.random() * 1.3;
      p.color = "#dbe6ee";
      p.gravity = 0;
    }
  }

  /** Booster: a flare that erupts backwards and upwards, hot core first. */
  flame(x: number, y: number, angle: number, n: number) {
    const hues = ["#fff2c4", "#ffd24a", "#ff9d2e", "#f4562a", "#c22f1a"];
    for (let i = 0; i < n; i++) {
      const p = this.take();
      if (!p) return;
      const t = i / n;
      const spray = angle + Math.PI + (Math.random() - 0.5) * 1.1;
      const sp = 1.6 + Math.random() * 5.5;
      p.on = true;
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
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 1;
      p.max = p.life = 30 + Math.random() * 26;
      p.r = 1.5 + Math.random() * 2.6;
      p.color = color;
      p.gravity = 0.06;
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    for (const p of this.pool) {
      if (!p.on) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.97;
      p.life--;
      if (p.life <= 0) { p.on = false; continue; }

      ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.gravity === 0 ? 0.85 : 0.55);
      ctx.fillStyle = p.color;
      if (p.gravity === 0) {
        ctx.fillRect(p.x, p.y, 26, p.r * 1.4); // wind streak / speed line
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.on = false;
  }
}
