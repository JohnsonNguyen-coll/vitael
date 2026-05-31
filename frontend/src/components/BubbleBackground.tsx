"use client";

import React, { useEffect, useRef } from "react";

interface Bubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
  glowColor: string;
  apy: string;
  wiggle: number;
  wiggleSpeed: number;
}

export default function BubbleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    // Resize Handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // Bubble definitions
    const bubbles: Bubble[] = [];
    const bubbleCount = 18; // Clean, elegant count

    // Premium multi-color palettes
    const bubbleColors = [
      "rgba(0, 245, 255, ",  // Electric Cyan
      "rgba(255, 0, 200, ",  // Neon Magenta
      "rgba(139, 0, 255, "   // Cyber Purple
    ];
    const glowColors = [
      "rgba(0, 245, 255, 0.45)",
      "rgba(255, 0, 200, 0.45)",
      "rgba(139, 0, 255, 0.45)"
    ];
    const apys = ["8.2%", "12.4%", "15.7%", "9.8%", "14.2%"];

    // Initialize bubbles
    for (let i = 0; i < bubbleCount; i++) {
      const colorIndex = Math.floor(Math.random() * bubbleColors.length);
      bubbles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 300,
        size: Math.random() * 35 + 25, // elegant floating sizes
        speed: Math.random() * 0.5 + 0.3, // slow, calming movement
        opacity: Math.random() * 0.25 + 0.08, // soft, trustful opacity
        color: bubbleColors[colorIndex],
        glowColor: glowColors[colorIndex],
        apy: Math.random() > 0.4 ? apys[Math.floor(Math.random() * apys.length)] : "",
        wiggle: Math.random() * 100,
        wiggleSpeed: Math.random() * 0.015 + 0.005
      });
    }

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle dark background overlay
      ctx.fillStyle = "rgba(10, 20, 40, 0.1)"; // overlay
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Bubbles
      bubbles.forEach((b) => {
        // Update positions
        b.y -= b.speed;
        b.wiggle += b.wiggleSpeed;
        const xOffset = Math.sin(b.wiggle) * 12;

        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x + xOffset, b.y, b.size, 0, Math.PI * 2);

        // Radial iridescent gradient
        const grad = ctx.createRadialGradient(
          b.x + xOffset - b.size / 3,
          b.y - b.size / 3,
          b.size / 10,
          b.x + xOffset,
          b.y,
          b.size
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * 0.45})`);
        grad.addColorStop(0.5, `${b.color}${b.opacity * 0.15})`);
        grad.addColorStop(1, `${b.color}${b.opacity * 0.35})`);

        ctx.fillStyle = grad;
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity * 0.2})`;
        ctx.lineWidth = 1;
        ctx.shadowColor = b.glowColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();

        // Draw APY inside bubble if set
        if (b.apy) {
          ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity + 0.45})`;
          ctx.font = `600 ${b.size * 0.28}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowBlur = 5;
          ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
          ctx.fillText(b.apy, b.x + xOffset, b.y);
        }

        ctx.restore();

        // Reset when it floats out of top screen
        if (b.y < -b.size) {
          b.y = canvas.height + Math.random() * 200;
          b.x = Math.random() * canvas.width;
          b.opacity = Math.random() * 0.25 + 0.08;
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-50 pointer-events-none"
    />
  );
}
