import type { SpeciesId } from "./types";

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  id: SpeciesId,
  footX: number,
  footY: number,
  height: number,
): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (id) {
    case "pipkin":
      drawPipkin(ctx, footX, footY, height);
      break;
    case "cindermote":
      drawCindermote(ctx, footX, footY, height);
      break;
    case "brooklet":
      drawBrooklet(ctx, footX, footY, height);
      break;
    case "pebbleback":
      drawPebbleback(ctx, footX, footY, height);
      break;
    case "fernskip":
      drawFernskip(ctx, footX, footY, height);
      break;
    case "ashling":
      drawAshling(ctx, footX, footY, height);
      break;
    case "kelpwisp":
      drawKelpwisp(ctx, footX, footY, height);
      break;
    case "graven":
      drawGraven(ctx, footX, footY, height);
      break;
  }
  ctx.restore();
}

export function drawWarden(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  height: number,
  kind: "player" | "boss",
): void {
  const u = height / 42;
  const cloak = kind === "boss" ? "#6d726b" : "#2f5a38";
  const cloakDeep = kind === "boss" ? "#454942" : "#1b3a24";
  const trim = kind === "boss" ? "#d2ae62" : "#e6d2a4";
  const hood = kind === "boss" ? "#596057" : "#244830";
  ctx.save();
  ctx.lineJoin = "round";
  shadow(ctx, footX, footY, 11 * u, 4 * u);
  blob(ctx, cloak, cloakDeep, Math.max(1.5, 1.4 * u), () => {
    ctx.moveTo(footX - 7 * u, footY - 1 * u);
    ctx.lineTo(footX - 13 * u, footY - 12 * u);
    ctx.lineTo(footX - 9 * u, footY - 30 * u);
    ctx.quadraticCurveTo(footX, footY - 36 * u, footX + 9 * u, footY - 30 * u);
    ctx.lineTo(footX + 13 * u, footY - 12 * u);
    ctx.lineTo(footX + 7 * u, footY - 1 * u);
    ctx.closePath();
  });
  ctx.fillStyle = trim;
  ctx.fillRect(footX - 2 * u, footY - 24 * u, 4 * u, 16 * u);
  blob(ctx, hood, cloakDeep, Math.max(1.25, u), () => {
    ctx.ellipse(footX, footY - 31 * u, 7.2 * u, 8 * u, 0, 0, Math.PI * 2);
  });
  ctx.fillStyle = "#1a2118";
  ctx.beginPath();
  ctx.ellipse(footX, footY - 30 * u, 3.4 * u, 4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(footX - 8 * u, footY - 4 * u, 5 * u, 4 * u);
  ctx.fillRect(footX + 3 * u, footY - 4 * u, 5 * u, 4 * u);
  ctx.fillStyle = kind === "boss" ? "#8d5a32" : "#6b4228";
  ctx.beginPath();
  ctx.ellipse(footX - 9 * u, footY - 14 * u, 3.2 * u, 4 * u, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "boss") {
    ctx.strokeStyle = "#e4c56e";
    ctx.lineWidth = Math.max(2, 1.6 * u);
    ctx.beginPath();
    ctx.arc(footX + 11 * u, footY - 16 * u, 5.5 * u, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPipkin(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 12 * u, 4 * u);
  ctx.fillStyle = "#d7ebc8";
  wing(ctx, x - 14 * u, y - 16 * u, 12 * u, -0.6);
  wing(ctx, x + 14 * u, y - 16 * u, 12 * u, 0.6);
  blob(ctx, "#f4e2b3", "#6a5430", Math.max(1.4, u), () => {
    ctx.ellipse(x, y - 14 * u, 11 * u, 10 * u, 0, 0, Math.PI * 2);
  });
  ctx.fillStyle = "#fff6df";
  ctx.beginPath();
  ctx.ellipse(x, y - 11 * u, 6 * u, 5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  leaf(ctx, x - 1 * u, y - 26 * u, 8 * u, "#3e8f45", -0.8);
  leaf(ctx, x + 2 * u, y - 27 * u, 8 * u, "#2f7a38", 0.7);
  ctx.strokeStyle = "#246032";
  ctx.lineWidth = Math.max(1.5, u);
  ctx.beginPath();
  ctx.moveTo(x, y - 22 * u);
  ctx.lineTo(x, y - 30 * u);
  ctx.stroke();
  eye(ctx, x - 4 * u, y - 15 * u, 1.6 * u);
  eye(ctx, x + 3 * u, y - 15 * u, 1.6 * u);
  ctx.fillStyle = "#e0a04a";
  ctx.beginPath();
  ctx.moveTo(x + 6 * u, y - 13 * u);
  ctx.lineTo(x + 12 * u, y - 11 * u);
  ctx.lineTo(x + 6 * u, y - 9 * u);
  ctx.closePath();
  ctx.fill();
  foot(ctx, x - 5 * u, y - 4 * u, 3 * u);
  foot(ctx, x + 3 * u, y - 4 * u, 3 * u);
}

function drawCindermote(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 16 * u, 4 * u);
  mothWing(ctx, x - 16 * u, y - 18 * u, -1);
  mothWing(ctx, x + 16 * u, y - 18 * u, 1);
  blob(ctx, "#2c2826", "#1a1614", Math.max(1.3, u), () => {
    ctx.ellipse(x, y - 14 * u, 5 * u, 9 * u, 0, 0, Math.PI * 2);
  });
  ctx.fillStyle = "#f0a04a";
  ctx.beginPath();
  ctx.ellipse(x, y - 12 * u, 2.4 * u, 5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a332c";
  ctx.lineWidth = Math.max(1.2, 0.8 * u);
  antenna(ctx, x - 2 * u, y - 22 * u, x - 6 * u, y - 30 * u);
  antenna(ctx, x + 2 * u, y - 22 * u, x + 6 * u, y - 30 * u);
  ctx.fillStyle = "#ffb15a";
  dot(ctx, x - 6 * u, y - 30 * u, 2 * u);
  dot(ctx, x + 6 * u, y - 30 * u, 2 * u);
  eye(ctx, x - 2 * u, y - 16 * u, 1.2 * u);
  eye(ctx, x + 2 * u, y - 16 * u, 1.2 * u);
}

function drawBrooklet(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 11 * u, 4 * u);
  blob(ctx, "#3aa0b0", "#1d5c68", Math.max(1.4, u), () => {
    ctx.moveTo(x, y - 30 * u);
    ctx.bezierCurveTo(x + 16 * u, y - 26 * u, x + 14 * u, y - 6 * u, x, y - 4 * u);
    ctx.bezierCurveTo(x - 14 * u, y - 6 * u, x - 16 * u, y - 26 * u, x, y - 30 * u);
  });
  ctx.fillStyle = "#d9f6f4";
  ctx.beginPath();
  ctx.ellipse(x, y - 12 * u, 6 * u, 7 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  fin(ctx, x - 12 * u, y - 16 * u, -1);
  fin(ctx, x + 12 * u, y - 16 * u, 1);
  eye(ctx, x - 3 * u, y - 18 * u, 1.7 * u);
  eye(ctx, x + 3 * u, y - 18 * u, 1.7 * u);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  dot(ctx, x + 8 * u, y - 28 * u, 2.2 * u);
  dot(ctx, x - 9 * u, y - 24 * u, 1.4 * u);
}

function drawPebbleback(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 16 * u, 4.5 * u);
  blob(ctx, "#8d8a84", "#3e4248", Math.max(1.5, u), () => {
    ctx.ellipse(x, y - 12 * u, 16 * u, 10 * u, 0, Math.PI, 0);
    ctx.lineTo(x + 14 * u, y - 6 * u);
    ctx.quadraticCurveTo(x, y - 2 * u, x - 14 * u, y - 6 * u);
    ctx.closePath();
  });
  ctx.strokeStyle = "#5d645c";
  ctx.lineWidth = Math.max(1.2, 0.8 * u);
  ctx.beginPath();
  ctx.moveTo(x - 8 * u, y - 14 * u);
  ctx.lineTo(x, y - 8 * u);
  ctx.lineTo(x + 8 * u, y - 14 * u);
  ctx.moveTo(x, y - 18 * u);
  ctx.lineTo(x, y - 8 * u);
  ctx.stroke();
  ctx.fillStyle = "#6f9a55";
  dot(ctx, x - 6 * u, y - 15 * u, 1.8 * u);
  dot(ctx, x + 5 * u, y - 12 * u, 1.5 * u);
  blob(ctx, "#d9c7a4", "#6a5438", Math.max(1, 0.8 * u), () => {
    ctx.ellipse(x + 12 * u, y - 8 * u, 4 * u, 3.4 * u, 0, 0, Math.PI * 2);
  });
  eye(ctx, x + 13 * u, y - 9 * u, 1 * u);
  foot(ctx, x - 10 * u, y - 3 * u, 3.4 * u);
  foot(ctx, x - 3 * u, y - 2 * u, 3.4 * u);
  foot(ctx, x + 4 * u, y - 2 * u, 3.4 * u);
}

function drawFernskip(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 8 * u, 3.5 * u);
  leaf(ctx, x - 2 * u, y - 34 * u, 14 * u, "#63b84a", -0.9);
  leaf(ctx, x + 2 * u, y - 34 * u, 14 * u, "#3d9140", 0.9);
  blob(ctx, "#8fd06a", "#2c6a30", Math.max(1.3, u), () => {
    ctx.ellipse(x, y - 16 * u, 5 * u, 11 * u, 0, 0, Math.PI * 2);
  });
  ctx.fillStyle = "#f4ffe8";
  ctx.beginPath();
  ctx.ellipse(x, y - 14 * u, 2.4 * u, 6 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, x - 2 * u, y - 20 * u, 1.2 * u);
  eye(ctx, x + 2 * u, y - 20 * u, 1.2 * u);
  ctx.strokeStyle = "#6b4a2c";
  ctx.lineWidth = Math.max(1.6, u);
  ctx.beginPath();
  ctx.moveTo(x - 2 * u, y - 6 * u);
  ctx.lineTo(x - 6 * u, y - 1 * u);
  ctx.moveTo(x + 2 * u, y - 7 * u);
  ctx.lineTo(x + 7 * u, y - 8 * u);
  ctx.stroke();
  leaf(ctx, x + 8 * u, y - 12 * u, 8 * u, "#2f8a44", 1.2);
}

function drawAshling(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 15 * u, 4 * u);
  flame(ctx, x + 16 * u, y - 16 * u, 10 * u);
  blob(ctx, "#2a2724", "#141210", Math.max(1.4, u), () => {
    ctx.ellipse(x - 2 * u, y - 10 * u, 13 * u, 6 * u, 0, 0, Math.PI * 2);
  });
  ctx.fillStyle = "#e15a28";
  ctx.beginPath();
  ctx.ellipse(x - 2 * u, y - 8 * u, 8 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a4038";
  ctx.lineWidth = Math.max(1.5, u);
  leg(ctx, x - 8 * u, y - 6 * u, x - 10 * u, y - 1 * u);
  leg(ctx, x - 2 * u, y - 5 * u, x - 1 * u, y - 1 * u);
  leg(ctx, x + 4 * u, y - 5 * u, x + 6 * u, y - 1 * u);
  leg(ctx, x + 8 * u, y - 6 * u, x + 11 * u, y - 1 * u);
  eye(ctx, x - 10 * u, y - 12 * u, 1.4 * u);
  ctx.fillStyle = "#f0c14a";
  dot(ctx, x - 14 * u, y - 10 * u, 1.5 * u);
}

function drawKelpwisp(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 40;
  shadow(ctx, x, y, 10 * u, 3.5 * u);
  ribbon(ctx, x - 6 * u, y - 16 * u, x - 10 * u, y - 2 * u, "#1e7a72");
  ribbon(ctx, x, y - 14 * u, x + 1 * u, y - 1 * u, "#2f9a86");
  ribbon(ctx, x + 6 * u, y - 16 * u, x + 11 * u, y - 4 * u, "#14685e");
  blob(ctx, "#8fd8c4", "#1c6a60", Math.max(1.4, u), () => {
    ctx.arc(x, y - 24 * u, 10 * u, Math.PI, 0);
    ctx.quadraticCurveTo(x + 8 * u, y - 14 * u, x, y - 16 * u);
    ctx.quadraticCurveTo(x - 8 * u, y - 14 * u, x - 10 * u, y - 24 * u);
  });
  ctx.fillStyle = "rgba(255,255,240,0.8)";
  ctx.beginPath();
  ctx.ellipse(x, y - 24 * u, 4 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, x - 3 * u, y - 23 * u, 1.3 * u);
  eye(ctx, x + 3 * u, y - 23 * u, 1.3 * u);
}

function drawGraven(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const u = h / 48;
  shadow(ctx, x, y, 16 * u, 5 * u);
  ctx.fillStyle = "#5e666c";
  ctx.fillRect(x - 16 * u, y - 8 * u, 8 * u, 8 * u);
  ctx.fillRect(x + 8 * u, y - 8 * u, 8 * u, 8 * u);
  blob(ctx, "#8b9398", "#2e3638", Math.max(1.6, u), () => {
    ctx.moveTo(x - 16 * u, y - 6 * u);
    ctx.lineTo(x - 18 * u, y - 28 * u);
    ctx.lineTo(x - 12 * u, y - 40 * u);
    ctx.lineTo(x + 12 * u, y - 40 * u);
    ctx.lineTo(x + 18 * u, y - 28 * u);
    ctx.lineTo(x + 16 * u, y - 6 * u);
    ctx.closePath();
  });
  ctx.fillStyle = "#6f7a62";
  ctx.fillRect(x - 2 * u, y - 34 * u, 2 * u, 20 * u);
  ctx.fillRect(x - 8 * u, y - 22 * u, 10 * u, 2 * u);
  ctx.strokeStyle = "#e0b85a";
  ctx.lineWidth = Math.max(2, 1.5 * u);
  ctx.beginPath();
  ctx.arc(x, y - 20 * u, 5 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f0c14a";
  ctx.fillRect(x - 7 * u, y - 32 * u, 4 * u, 3 * u);
  ctx.fillRect(x + 3 * u, y - 32 * u, 4 * u, 3 * u);
  ctx.fillStyle = "#2c3334";
  ctx.fillRect(x - 14 * u, y - 36 * u, 28 * u, 3 * u);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(16, 28, 18, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function blob(
  ctx: CanvasRenderingContext2D,
  fill: string,
  stroke: string,
  weight: number,
  trace: () => void,
): void {
  ctx.beginPath();
  trace();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = weight;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "#1c2418";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function foot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = "#6b5438";
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

function leaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  color: string,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(len * 0.45, 0, len * 0.5, len * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#d7ebc8";
  ctx.strokeStyle = "#5d8a62";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function mothWing(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.fillStyle = "#e36a2f";
  ctx.strokeStyle = "#6a3018";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - dir * 2, y);
  ctx.quadraticCurveTo(x + dir * 18, y - 16, x + dir * 8, y + 8);
  ctx.quadraticCurveTo(x + dir * 16, y + 14, x - dir * 2, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2c241c";
  ctx.beginPath();
  ctx.arc(x + dir * 8, y - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function antenna(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 4, x2, y2);
  ctx.stroke();
}

function fin(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.fillStyle = "#7ed0d4";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * 10, y - 6);
  ctx.lineTo(x + dir * 4, y + 6);
  ctx.closePath();
  ctx.fill();
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = "#f0a030";
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + h * 0.6, y - h * 0.3, x + h * 0.15, y);
  ctx.quadraticCurveTo(x - h * 0.1, y - h * 0.4, x, y - h);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.72);
  ctx.quadraticCurveTo(x + h * 0.25, y - h * 0.3, x, y - h * 0.15);
  ctx.quadraticCurveTo(x - h * 0.12, y - h * 0.4, x, y - h * 0.72);
  ctx.fill();
}

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function ribbon(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(x1 + (x2 - x1) * 0.3, (y1 + y2) / 2, x2, y2);
  ctx.stroke();
}
