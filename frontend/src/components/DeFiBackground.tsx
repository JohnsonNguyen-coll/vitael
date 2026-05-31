"use client";

import { useEffect, useRef } from "react";

interface Particle {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    symbol: string;
}

interface Bubble {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    apy: string;
    wiggle: number;
    wiggleSpeed: number;
}

export default function DeFiBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;

        // Resize handler
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", handleResize);
        handleResize();

        // Initialize particles (USDC Waterfall)
        const particles: Particle[] = [];
        const particleCount = 60;
        const symbols = ["$", "USDC", "yield", "vUSDC"];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                size: Math.random() * 8 + 4,
                speed: Math.random() * 2 + 1.5,
                opacity: Math.random() * 0.4 + 0.1,
                symbol: symbols[Math.floor(Math.random() * symbols.length)]
            });
        }

        // Initialize APY Bubbles
        const bubbles: Bubble[] = [];
        const bubbleCount = 12;
        const apys = ["8.2%", "12.4%", "15.7%", "9.8%", "14.2%"];

        for (let i = 0; i < bubbleCount; i++) {
            bubbles.push({
                x: Math.random() * canvas.width,
                y: canvas.height + Math.random() * 200,
                size: Math.random() * 40 + 40,
                speed: Math.random() * 0.8 + 0.4,
                opacity: Math.random() * 0.5 + 0.1,
                apy: apys[Math.floor(Math.random() * apys.length)],
                wiggle: Math.random() * 100,
                wiggleSpeed: Math.random() * 0.02 + 0.01
            });
        }

        // Draw loop
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw digital money waterfall (USDC columns)
            particles.forEach((p) => {
                ctx.fillStyle = `rgba(0, 245, 255, ${p.opacity})`;
                ctx.shadowColor = "rgba(0, 245, 255, 0.8)";
                ctx.shadowBlur = 10;
                
                // Draw text
                ctx.font = `${p.size}px monospace`;
                ctx.fillText(p.symbol, p.x, p.y);

                // Update position
                p.y += p.speed;
                if (p.y > canvas.height) {
                    p.y = -50;
                    p.x = Math.random() * canvas.width;
                }
            });

            // Reset shadow
            ctx.shadowBlur = 0;

            // 2. Draw APY Bubbles
            bubbles.forEach((b) => {
                // Update position with horizontal wiggling
                b.y -= b.speed;
                b.wiggle += b.wiggleSpeed;
                const xOffset = Math.sin(b.wiggle) * 15;

                // Draw Bubble circle
                ctx.save();
                ctx.beginPath();
                ctx.arc(b.x + xOffset, b.y, b.size, 0, Math.PI * 2);
                
                // Gradient for iridescence
                const grad = ctx.createRadialGradient(
                    b.x + xOffset - b.size / 3,
                    b.y - b.size / 3,
                    b.size / 10,
                    b.x + xOffset,
                    b.y,
                    b.size
                );
                grad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * 0.4})`);
                grad.addColorStop(0.5, `rgba(0, 245, 255, ${b.opacity * 0.15})`);
                grad.addColorStop(1, `rgba(139, 0, 255, ${b.opacity * 0.25})`);
                
                ctx.fillStyle = grad;
                ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity * 0.25})`;
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();

                // Draw APY text inside
                ctx.fillStyle = `rgba(0, 245, 255, ${b.opacity + 0.3})`;
                ctx.shadowColor = "rgba(0, 245, 255, 0.5)";
                ctx.shadowBlur = 8;
                ctx.font = `600 ${b.size * 0.3}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(b.apy, b.x + xOffset, b.y);
                ctx.restore();

                // Reset bubble if out of top boundary
                if (b.y < -b.size) {
                    b.y = canvas.height + Math.random() * 200;
                    b.x = Math.random() * canvas.width;
                    b.opacity = Math.random() * 0.5 + 0.1;
                }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        // Cleanup
        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none"
        />
    );
}
