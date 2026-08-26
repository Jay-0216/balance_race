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

  constructor(size = 260) {
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

      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.55;
      ctx.fillStyle = p.color;
      if (p.gravity === 0) {
        ctx.fillRect(p.x, p.y, 14, p.r);       // speed line
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
