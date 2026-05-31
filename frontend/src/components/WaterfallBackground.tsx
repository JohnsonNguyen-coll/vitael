"use client";

import { useEffect, useRef } from "react";

const BASE_HUE = 190;

export default function WaterfallBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // After the null-checks above, TypeScript still widens the type inside
    // nested functions. We pin them to non-null locals used throughout.
    const C = canvas as HTMLCanvasElement;
    const X = ctx as CanvasRenderingContext2D;

    let animId = 0;
    let t = 0;

    // ── types ────────────────────────────────────────────────────────────────
    type Drop   = { x:number; y:number; len:number; spd:number; op:number; w:number; hue:number };
    type Splash = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; sz:number; op:number };
    type Mist   = { x:number; y:number; r:number; op:number; drift:number; ds:number; rs:number };
    type Stream = { x:number; w:number; op:number; off:number };

    // ── state ────────────────────────────────────────────────────────────────
    const streams: Stream[] = [];
    const drops:   Drop[]   = [];
    const mists:   Mist[]   = [];
    let   splashes: Splash[] = [];

    // ── factories ────────────────────────────────────────────────────────────
    const mkDrop = (rndY: boolean): Drop => ({
      x:   Math.random() * C.width,
      y:   rndY ? Math.random() * C.height : -30,
      len: Math.random() * 30 + 12,
      spd: Math.random() * 8 + 5,
      op:  Math.random() * 0.55 + 0.25,
      w:   Math.random() * 2 + 0.8,
      hue: BASE_HUE + (Math.random() - 0.5) * 30,
    });

    const mkSplash = (x: number, y: number): Splash => {
      const a = Math.random() * Math.PI;
      const s = Math.random() * 4 + 1.5;
      return { x, y, vx: Math.cos(a)*s*(Math.random()>.5?1:-1), vy: -Math.sin(a)*s,
               life: 0, maxLife: Math.random()*35+20, sz: Math.random()*3+0.8, op: Math.random()*0.7+0.3 };
    };

    const mkMist = (rndY: boolean): Mist => ({
      x:  Math.random() * C.width,
      y:  rndY ? Math.random() * C.height : C.height + 60,
      r:  Math.random() * 140 + 70,
      op: Math.random() * 0.08 + 0.02,
      drift: Math.random() * Math.PI * 2,
      ds: Math.random() * 0.005 + 0.001,
      rs: Math.random() * 0.4 + 0.15,
    });

    // ── init ─────────────────────────────────────────────────────────────────
    function init() {
      C.width  = window.innerWidth;
      C.height = window.innerHeight;

      streams.length = 0;
      drops.length   = 0;
      mists.length   = 0;
      splashes       = [];

      const cols = 32;
      const gap  = C.width / cols;
      for (let i = 0; i < cols; i++) {
        streams.push({
          x:   i * gap + gap * 0.5 + (Math.random() - 0.5) * gap * 0.5,
          w:   Math.random() * 8 + 3,
          op:  Math.random() * 0.22 + 0.08,
          off: Math.random() * Math.PI * 2,
        });
      }
      for (let i = 0; i < 140; i++) drops.push(mkDrop(true));
      for (let i = 0; i < 20;  i++) mists.push(mkMist(true));
    }

    // ── draw ─────────────────────────────────────────────────────────────────
    function drawBg() {
      X.fillStyle = "#050b14";
      X.fillRect(0, 0, C.width, C.height);
    }

    function drawStreams() {
      for (const s of streams) {
        const x = s.x + Math.sin(t * 0.5 + s.off) * 5;
        const g = X.createLinearGradient(x, 0, x, C.height);
        g.addColorStop(0,    `hsla(${BASE_HUE},100%,80%,0)`);
        g.addColorStop(0.05, `hsla(${BASE_HUE},100%,82%,${s.op * 1.6})`);
        g.addColorStop(0.4,  `hsla(${BASE_HUE+10},95%,72%,${s.op * 1.2})`);
        g.addColorStop(0.8,  `hsla(${BASE_HUE+20},85%,65%,${s.op * 0.7})`);
        g.addColorStop(1,    `hsla(${BASE_HUE+25},80%,60%,0)`);
        X.save();
        X.beginPath();
        X.moveTo(x, 0);
        X.lineTo(x, C.height);
        X.lineWidth    = s.w;
        X.strokeStyle  = g;
        X.shadowColor  = `hsla(${BASE_HUE},100%,75%,0.6)`;
        X.shadowBlur   = 12;
        X.stroke();
        X.restore();
      }
    }

    function drawDrops() {
      for (const d of drops) {
        d.y += d.spd;
        d.x += Math.sin(t * 0.4 + d.y * 0.015) * 0.4;

        const g = X.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
        g.addColorStop(0,   `hsla(${d.hue},100%,88%,0)`);
        g.addColorStop(0.5, `hsla(${d.hue},100%,85%,${d.op * 0.6})`);
        g.addColorStop(1,   `hsla(${d.hue},100%,92%,${d.op})`);

        X.save();
        X.beginPath();
        X.moveTo(d.x, d.y - d.len);
        X.lineTo(d.x, d.y);
        X.lineWidth   = d.w;
        X.strokeStyle = g;
        X.shadowColor = `hsla(${d.hue},100%,85%,0.7)`;
        X.shadowBlur  = 6;
        X.stroke();
        X.restore();

        if (d.y > C.height + d.len) {
          if (splashes.length < 300) {
            const n = Math.floor(Math.random() * 5) + 2;
            for (let i = 0; i < n; i++) splashes.push(mkSplash(d.x, C.height - 4));
          }
          Object.assign(d, mkDrop(false));
        }
      }
    }

    function drawSplashes() {
      splashes = splashes.filter(s => s.life < s.maxLife);
      for (const s of splashes) {
        s.life++;
        s.x  += s.vx;
        s.y  += s.vy;
        s.vy += 0.15;
        s.vx *= 0.97;
        const p = s.life / s.maxLife;
        const a = s.op * (1 - p);
        X.save();
        X.beginPath();
        X.arc(s.x, s.y, Math.max(0.1, s.sz * (1 - p * 0.5)), 0, Math.PI * 2);
        X.fillStyle   = `hsla(${BASE_HUE},100%,88%,${a})`;
        X.shadowColor = `hsla(${BASE_HUE},100%,85%,${a})`;
        X.shadowBlur  = 8;
        X.fill();
        X.restore();
      }
    }

    function drawMist() {
      for (const m of mists) {
        m.y     -= m.rs;
        m.drift += m.ds;
        m.x     += Math.sin(m.drift) * 0.6;
        if (m.y < -m.r * 2) Object.assign(m, mkMist(false));

        const g = X.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g.addColorStop(0, `hsla(${BASE_HUE},80%,78%,${m.op})`);
        g.addColorStop(1, `hsla(${BASE_HUE},60%,65%,0)`);
        X.save();
        X.beginPath();
        X.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        X.fillStyle = g;
        X.fill();
        X.restore();
      }
    }

    function drawPool() {
      const ph = C.height * 0.15;
      const g  = X.createLinearGradient(0, C.height - ph, 0, C.height);
      g.addColorStop(0,   `hsla(${BASE_HUE},100%,65%,0)`);
      g.addColorStop(0.5, `hsla(${BASE_HUE},100%,68%,0.06)`);
      g.addColorStop(1,   `hsla(${BASE_HUE},100%,72%,0.14)`);
      X.fillStyle = g;
      X.fillRect(0, C.height - ph, C.width, ph);

      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.7 + (i * Math.PI * 2) / 6) % (Math.PI * 2);
        const prog  = (Math.sin(phase) + 1) / 2;
        const rx    = (C.width * (i + 1)) / 7;
        const r     = prog * (55 + i * 18);
        const alpha = (1 - prog) * 0.18;
        X.save();
        X.beginPath();
        X.ellipse(rx, C.height - 8, r, r * 0.22, 0, 0, Math.PI * 2);
        X.strokeStyle = `hsla(${BASE_HUE},100%,82%,${alpha})`;
        X.lineWidth   = 1.5;
        X.stroke();
        X.restore();
      }
    }

    function drawShimmer() {
      for (let i = 0; i < 5; i++) {
        const y = (t * 60 + (i * C.height) / 5) % C.height;
        const a = 0.018 + Math.sin(t * 0.6 + i) * 0.009;
        const g = X.createLinearGradient(0, y, C.width, y);
        g.addColorStop(0,    `hsla(${BASE_HUE},100%,85%,0)`);
        g.addColorStop(0.35, `hsla(${BASE_HUE},100%,88%,${a})`);
        g.addColorStop(0.5,  `hsla(${BASE_HUE+15},100%,92%,${a*1.6})`);
        g.addColorStop(0.65, `hsla(${BASE_HUE},100%,88%,${a})`);
        g.addColorStop(1,    `hsla(${BASE_HUE},100%,85%,0)`);
        X.fillStyle = g;
        X.fillRect(0, y - 1, C.width, 2.5);
      }
    }

    // ── loop ─────────────────────────────────────────────────────────────────
    function loop() {
      t += 0.018;
      drawBg();
      drawShimmer();
      drawStreams();
      drawDrops();
      drawSplashes();
      drawMist();
      drawPool();
      animId = requestAnimationFrame(loop);
    }

    init();
    loop();

    window.addEventListener("resize", init);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", init);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-50 pointer-events-none"
    />
  );
}
