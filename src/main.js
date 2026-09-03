import './style.css';
import { sfxCueHit, sfxBallClack, sfxCushion, sfxPocket, sfxVictory, sfxClick } from './audio.js';

// =============================================
//  KAWAII 8-BALL POOL 🎱✨
//  Super cute 2D pool with custom physics
// =============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageEl = document.getElementById('message');
const playAgainBtn = document.getElementById('play-again-btn');
const endActionsContainer = document.getElementById('end-actions-container');
const aimHintEl = document.getElementById('aim-hint');
const p1Panel = document.getElementById('p1-panel');
const p2Panel = document.getElementById('p2-panel');
const p1Type = document.getElementById('p1-type');
const p2Type = document.getElementById('p2-type');

// =============================================
//  TABLE DIMENSIONS
// =============================================
const TABLE_W = 900;
const TABLE_H = 500;
const BORDER = 36;
const POCKET_R = 22;
const BALL_R = 12;
const CUE_BALL_R = 12;

canvas.width = TABLE_W + BORDER * 2;
canvas.height = TABLE_H + BORDER * 2;

// =============================================
//  GAME STATE
// =============================================
let balls = [];
let cueBall = null;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragEnd = { x: 0, y: 0 };
let currentPlayer = 1;      // 1 or 2
let playerTypes = { 1: null, 2: null }; // 'solid' or 'stripe', assigned on first pocket
let gameOver = false;
let foulThisTurn = false;
let ballsPocketedThisTurn = [];
let turnActive = false;      // True while balls are moving
let sparkles = [];
let hearts = [];
let cueBallPlacing = false;  // When cue ball is in hand

// Pockets (center positions)
const pockets = [
  { x: BORDER + 4, y: BORDER + 4 },                         // top-left
  { x: BORDER + TABLE_W / 2, y: BORDER - 2 },              // top-center
  { x: BORDER + TABLE_W - 4, y: BORDER + 4 },              // top-right
  { x: BORDER + 4, y: BORDER + TABLE_H - 4 },              // bottom-left
  { x: BORDER + TABLE_W / 2, y: BORDER + TABLE_H + 2 },    // bottom-center
  { x: BORDER + TABLE_W - 4, y: BORDER + TABLE_H - 4 },    // bottom-right
];

// =============================================
//  BALL COLORS & KAWAII FACES
// =============================================
const BALL_COLORS = {
  1:  '#ffd166',  // Yellow (solid)
  2:  '#74b9ff',  // Blue
  3:  '#ff6b6b',  // Red
  4:  '#a29bfe',  // Purple
  5:  '#ff9f43',  // Orange
  6:  '#06d6a0',  // Green
  7:  '#e17055',  // Maroon/brown
  8:  '#2d3436',  // Black (8-ball)
  9:  '#ffd166',  // Yellow (stripe)
  10: '#74b9ff',  // Blue
  11: '#ff6b6b',  // Red
  12: '#a29bfe',  // Purple
  13: '#ff9f43',  // Orange
  14: '#06d6a0',  // Green
  15: '#e17055',  // Maroon
};

// Kawaii expressions for each ball (randomized per game)
const KAWAII_FACES = [
  { eyes: 'round', mouth: 'smile' },
  { eyes: 'happy', mouth: 'open' },
  { eyes: 'round', mouth: 'cat' },
  { eyes: 'sparkle', mouth: 'smile' },
  { eyes: 'happy', mouth: 'tongue' },
  { eyes: 'wink', mouth: 'smile' },
  { eyes: 'round', mouth: 'o' },
  { eyes: 'cool', mouth: 'smile' },    // 8-ball is cool
  { eyes: 'round', mouth: 'cat' },
  { eyes: 'happy', mouth: 'smile' },
  { eyes: 'sparkle', mouth: 'open' },
  { eyes: 'round', mouth: 'tongue' },
  { eyes: 'wink', mouth: 'cat' },
  { eyes: 'happy', mouth: 'o' },
  { eyes: 'round', mouth: 'smile' },
];

// =============================================
//  BALL CLASS
// =============================================
class Ball {
  constructor(x, y, num) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = num === 0 ? CUE_BALL_R : BALL_R;
    this.num = num;          // 0 = cue ball
    this.color = num === 0 ? '#ffffff' : BALL_COLORS[num];
    this.isStripe = num >= 9;
    this.isSolid = num >= 1 && num <= 7;
    this.is8Ball = num === 8;
    this.pocketed = false;
    this.face = num === 0 ? { eyes: 'round', mouth: 'smile' } : KAWAII_FACES[num - 1];
    this.blinkTimer = Math.random() * 200;
    this.isBlinking = false;
    this.rotation = 0;
    this.squish = 1;        // For cute squish animation on collision
    this.squishDir = 0;
  }

  get isMoving() {
    return Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05;
  }

  update() {
    // Friction (smooth velvet roll)
    this.vx *= 0.988;
    this.vy *= 0.988;

    // Stop if very slow
    if (!this.isMoving) {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Rotation based on velocity
    this.rotation += Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 0.03;

    // Squish recovery
    if (this.squish !== 1) {
      this.squish += (1 - this.squish) * 0.15;
      if (Math.abs(this.squish - 1) < 0.01) this.squish = 1;
    }

    // Blinking
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkTimer = 150 + Math.random() * 200;
      setTimeout(() => { this.isBlinking = false; }, 120);
    }

    // Wall collisions
    const left = BORDER + this.r;
    const right = BORDER + TABLE_W - this.r;
    const top = BORDER + this.r;
    const bottom = BORDER + TABLE_H - this.r;

    if (this.x < left) { this.x = left; this.vx *= -0.8; this.triggerSquish(0); sfxCushion(); }
    if (this.x > right) { this.x = right; this.vx *= -0.8; this.triggerSquish(0); sfxCushion(); }
    if (this.y < top) { this.y = top; this.vy *= -0.8; this.triggerSquish(Math.PI / 2); sfxCushion(); }
    if (this.y > bottom) { this.y = bottom; this.vy *= -0.8; this.triggerSquish(Math.PI / 2); sfxCushion(); }
  }

  triggerSquish(dir) {
    this.squish = 0.8;
    this.squishDir = dir;
  }

  draw() {
    if (this.pocketed) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Squish transform
    if (this.squish !== 1) {
      ctx.rotate(this.squishDir);
      ctx.scale(this.squish, 2 - this.squish);
      ctx.rotate(-this.squishDir);
    }

    // Shadow
    ctx.beginPath();
    ctx.arc(2, 2, this.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Ball body
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);

    if (this.num === 0) {
      // Cue ball — white with subtle gradient
      const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, this.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = grad;
    } else {
      // Colored ball with gradient
      const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, this.r);
      grad.addColorStop(0, lightenColor(this.color, 40));
      grad.addColorStop(0.7, this.color);
      grad.addColorStop(1, darkenColor(this.color, 30));
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Stripe band for stripe balls
    if (this.isStripe) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.r, -4, this.r * 2, 8);
      ctx.restore();
    }

    // Number circle (except cue ball)
    if (this.num !== 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = 'bold 7px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.num, 0, 0.5);
    }

    // Kawaii face!
    this.drawFace();

    // Highlight (shine)
    ctx.beginPath();
    ctx.arc(-3, -4, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-1, -2, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    ctx.restore();
  }

  drawFace() {
    const faceY = this.num === 0 ? 0 : -1; // Slight offset since number takes center
    const ey = faceY - 2;
    const my = faceY + 4;
    const isLight = this.num === 0 || this.color === '#ffd166' || this.color === '#ffffff';
    const eyeColor = isLight ? '#2d3436' : '#ffffff';
    const mouthColor = isLight ? '#e17055' : '#ffb3d0';

    // --- EYES ---
    if (this.isBlinking) {
      // Closed eyes (happy lines)
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-3, ey, 1.5, 0, Math.PI, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, ey, 1.5, 0, Math.PI, true);
      ctx.stroke();
    } else {
      switch (this.face.eyes) {
        case 'round':
          ctx.fillStyle = eyeColor;
          ctx.beginPath(); ctx.arc(-3, ey, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(3, ey, 1.5, 0, Math.PI * 2); ctx.fill();
          // Tiny white highlights
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(-2.5, ey - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(3.5, ey - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
          break;
        case 'happy':
          ctx.strokeStyle = eyeColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(-3, ey + 0.5, 1.5, Math.PI, 0, true);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(3, ey + 0.5, 1.5, Math.PI, 0, true);
          ctx.stroke();
          break;
        case 'sparkle':
          this.drawStar(-3, ey, 2, eyeColor);
          this.drawStar(3, ey, 2, eyeColor);
          break;
        case 'wink':
          ctx.fillStyle = eyeColor;
          ctx.beginPath(); ctx.arc(-3, ey, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(-2.5, ey - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
          // Winking eye
          ctx.strokeStyle = eyeColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(3, ey + 0.5, 1.5, Math.PI, 0, true);
          ctx.stroke();
          break;
        case 'cool':
          // Sunglasses for 8-ball
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-6, ey - 2, 5, 3.5);
          ctx.fillRect(1, ey - 2, 5, 3.5);
          ctx.fillRect(-1, ey - 1, 2, 1);
          // Highlight on glasses
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(-5.5, ey - 1.5, 2, 1);
          ctx.fillRect(1.5, ey - 1.5, 2, 1);
          break;
      }
    }

    // --- MOUTH ---
    switch (this.face.mouth) {
      case 'smile':
        ctx.strokeStyle = mouthColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, my - 1, 2.5, 0.1, Math.PI - 0.1);
        ctx.stroke();
        break;
      case 'open':
        ctx.fillStyle = mouthColor;
        ctx.beginPath();
        ctx.ellipse(0, my, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tongue
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.ellipse(0, my + 1, 1.2, 0.8, 0, 0, Math.PI);
        ctx.fill();
        break;
      case 'cat':
        // Cat mouth :3
        ctx.strokeStyle = mouthColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2, my);
        ctx.quadraticCurveTo(-0.5, my + 1.5, 0, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, my);
        ctx.quadraticCurveTo(0.5, my + 1.5, 2, my);
        ctx.stroke();
        break;
      case 'tongue':
        ctx.strokeStyle = mouthColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, my - 1, 2.5, 0.1, Math.PI - 0.1);
        ctx.stroke();
        // Tongue sticking out
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.ellipse(0, my + 1.5, 1.5, 1.2, 0, 0, Math.PI);
        ctx.fill();
        break;
      case 'o':
        ctx.fillStyle = mouthColor;
        ctx.beginPath();
        ctx.arc(0, my, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    // Blush cheeks (always for kawaii!)
    ctx.fillStyle = 'rgba(255, 150, 180, 0.35)';
    ctx.beginPath(); ctx.ellipse(-5.5, my - 1, 2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5, my - 1, 2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawStar(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// =============================================
//  SPARKLE PARTICLE
// =============================================
class Sparkle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = 1;
    this.decay = 0.02 + Math.random() * 0.02;
    this.size = 2 + Math.random() * 3;
    this.color = color || '#ffd166';
    this.rotation = Math.random() * Math.PI * 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;
    this.life -= this.decay;
    this.rotation += 0.1;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;

    // Star shape
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * this.size, Math.sin(angle) * this.size);
    }
    ctx.stroke;

    // Diamond sparkle
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(this.size * 0.4, 0);
    ctx.lineTo(0, this.size);
    ctx.lineTo(-this.size * 0.4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// =============================================
//  HEART PARTICLE (on pocket!)
// =============================================
class Heart {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = -1.5 - Math.random() * 1.5;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.life = 1;
    this.decay = 0.015;
    this.size = 6 + Math.random() * 6;
    this.color = ['#ff6b9d', '#ff9f43', '#a29bfe', '#ffd166'][Math.floor(Math.random() * 4)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;

    // Heart shape
    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s * 0.5, -s * 0.3, -s, s * 0.1, 0, s);
    ctx.bezierCurveTo(s, s * 0.1, s * 0.5, -s * 0.3, 0, s * 0.3);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// =============================================
//  COLOR UTILS
// =============================================
function lightenColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + amt);
  g = Math.min(255, g + amt);
  b = Math.min(255, b + amt);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, r - amt);
  g = Math.max(0, g - amt);
  b = Math.max(0, b - amt);
  return `rgb(${r},${g},${b})`;
}

// =============================================
//  INITIALIZE BALLS (triangle rack)
// =============================================
function initBalls() {
  if (window.ArcadeDifficulty) ArcadeDifficulty.reset();
  balls = [];
  sparkles = [];
  hearts = [];

  // Cue ball
  cueBall = new Ball(BORDER + TABLE_W * 0.25, BORDER + TABLE_H / 2, 0);
  balls.push(cueBall);

  // Rack arrangement (standard 8-ball rack)
  // The 8-ball goes in the center of the third row
  const rackOrder = [1, 9, 2, 10, 8, 11, 3, 12, 6, 14, 4, 13, 7, 15, 5];
  const startX = BORDER + TABLE_W * 0.72;
  const startY = BORDER + TABLE_H / 2;
  const spacing = BALL_R * 2.1;

  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + row * spacing * Math.cos(Math.PI / 6);
      const y = startY + (col - row / 2) * spacing;
      const ball = new Ball(x, y, rackOrder[idx]);
      balls.push(ball);
      idx++;
    }
  }
}

// =============================================
//  PHYSICS
// =============================================
function resolveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.r + b.r;

  if (dist < minDist && dist > 0) {
    // Normal
    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;

    // Don't resolve if separating
    if (dvn <= 0) return;

    // Impulse (equal mass)
    const restitution = 0.95;
    const impulse = dvn * restitution;

    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;

    // Separate overlapping
    const overlap = (minDist - dist) / 2;
    a.x -= overlap * nx;
    a.y -= overlap * ny;
    b.x += overlap * nx;
    b.y += overlap * ny;

    // Cute squish!
    const collisionAngle = Math.atan2(ny, nx);
    a.triggerSquish(collisionAngle);
    b.triggerSquish(collisionAngle + Math.PI);

    // Cute clack sound!
    sfxBallClack(impulse);

    // Sparkles on collision!
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    for (let i = 0; i < 5; i++) {
      sparkles.push(new Sparkle(cx, cy, '#ffd166'));
    }
  }
}

function checkPockets(ball) {
  for (const pocket of pockets) {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const pocketedCount = balls.filter(b => b.pocketed && b.number !== 0).length;
    const poolScore = pocketedCount * 100 + ballsPocketedThisTurn.length * 50;
    const ddaMult = (typeof ArcadeDifficulty !== 'undefined' && ArcadeDifficulty.getMultiplier)
      ? ArcadeDifficulty.getMultiplier(poolScore, 1000, 1.8)
      : 1.0;
    const pocketFactor = Math.max(0.48, 0.75 - (ddaMult - 1.0) * 0.2);
    if (dist < POCKET_R + ball.r * pocketFactor) {
      ball.pocketed = true;
      ball.vx = 0;
      ball.vy = 0;
      sfxPocket();
      if (window.DopamineJuice) {
        const rect = canvas.getBoundingClientRect();
        const sx = rect.left + (pocket.x / canvas.width) * rect.width;
        const sy = rect.top + (pocket.y / canvas.height) * rect.height;
        window.DopamineJuice.spawnScore(sx, sy, `POCKET! 🎱✨`, 2);
      }

      // Hearts burst!
      for (let i = 0; i < 12; i++) {
        hearts.push(new Heart(pocket.x, pocket.y));
      }
      for (let i = 0; i < 8; i++) {
        sparkles.push(new Sparkle(pocket.x, pocket.y, ball.color));
      }

      ballsPocketedThisTurn.push(ball);
      return true;
    }
  }
  return false;
}

// =============================================
//  DRAWING
// =============================================
function drawTable() {
  // Outer wood frame
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#a0724a');
  grad.addColorStop(0.5, '#8b5e3c');
  grad.addColorStop(1, '#7a5232');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 14);
  ctx.fill();

  // Inner decorative trim
  ctx.strokeStyle = '#c9956b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 10);
  ctx.stroke();

  // Cute diamond decorations on the rails
  const diamondColor = '#d4a76a';
  // Top rail diamonds
  for (let i = 1; i <= 3; i++) {
    drawDiamond(BORDER + TABLE_W * (i / 4), BORDER / 2, 5, diamondColor);
  }
  // Bottom rail diamonds
  for (let i = 1; i <= 3; i++) {
    drawDiamond(BORDER + TABLE_W * (i / 4), BORDER + TABLE_H + BORDER / 2, 5, diamondColor);
  }
  // Left rail diamonds
  for (let i = 1; i <= 2; i++) {
    drawDiamond(BORDER / 2, BORDER + TABLE_H * (i / 3), 5, diamondColor);
  }
  // Right rail diamonds
  for (let i = 1; i <= 2; i++) {
    drawDiamond(BORDER + TABLE_W + BORDER / 2, BORDER + TABLE_H * (i / 3), 5, diamondColor);
  }

  // Green felt
  const feltGrad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 50,
    canvas.width / 2, canvas.height / 2, TABLE_W / 2
  );
  feltGrad.addColorStop(0, '#228b50');
  feltGrad.addColorStop(1, '#1a6b3c');
  ctx.fillStyle = feltGrad;
  ctx.fillRect(BORDER, BORDER, TABLE_W, TABLE_H);

  // Felt texture (subtle dots)
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let i = 0; i < 80; i++) {
    const x = BORDER + Math.random() * TABLE_W;
    const y = BORDER + Math.random() * TABLE_H;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pockets
  for (const p of pockets) {
    // Pocket shadow
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Pocket
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
    const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, POCKET_R);
    pGrad.addColorStop(0, '#0a0a0a');
    pGrad.addColorStop(0.8, '#1a1a1a');
    pGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = pGrad;
    ctx.fill();

    // Cute pocket rim highlight
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Head string line (dashed, subtle)
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(BORDER + TABLE_W * 0.25, BORDER);
  ctx.lineTo(BORDER + TABLE_W * 0.25, BORDER + TABLE_H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDiamond(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.5, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.5, y);
  ctx.closePath();
  ctx.fill();
}

function drawCueStick() {
  if (!isDragging || !cueBall || cueBall.pocketed) return;

  const dx = dragStart.x - dragEnd.x;
  const dy = dragStart.y - dragEnd.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const power = Math.min(dist / 200, 1);

  if (dist < 3) return;

  const angle = Math.atan2(dy, dx);

  // Direction line (laser guideline across the table)
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 + power * 0.35})`;
  ctx.lineWidth = 1.5;

  // Raycast to find nearest ball intersection along the aim vector
  const pocketedCountAim = balls.filter(b => b.pocketed && b.number !== 0).length;
  const poolScore = pocketedCountAim * 100 + ballsPocketedThisTurn.length * 50;
  const ddaMult = (typeof ArcadeDifficulty !== 'undefined' && ArcadeDifficulty.getMultiplier)
    ? ArcadeDifficulty.getMultiplier(poolScore, 1000, 1.8)
    : 1.0;
  let maxAimDist = Math.max(320, 550 - (ddaMult - 1.0) * 140);
  let targetBall = null;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (const b of balls) {
    if (b === cueBall || b.pocketed) continue;
    // Project b onto ray
    const rx = b.x - cueBall.x;
    const ry = b.y - cueBall.y;
    const proj = rx * cosA + ry * sinA;
    if (proj > 0 && proj < maxAimDist) {
      const perpDist = Math.abs(rx * sinA - ry * cosA);
      if (perpDist < b.r + cueBall.r) {
        maxAimDist = proj - Math.sqrt(Math.max(0, Math.pow(b.r + cueBall.r, 2) - perpDist * perpDist));
        targetBall = b;
      }
    }
  }

  const endX = cueBall.x + cosA * maxAimDist;
  const endY = cueBall.y + sinA * maxAimDist;

  ctx.beginPath();
  ctx.moveTo(cueBall.x, cueBall.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw Ghost Cue Ball at impact point
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(endX, endY, cueBall.r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Cue stick itself (behind the ball)
  ctx.save();
  ctx.translate(cueBall.x, cueBall.y);
  ctx.rotate(angle + Math.PI);

  const stickOffset = 15 + power * 40;
  const stickLen = 160;

  // Stick shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(stickOffset + 2, -2.5, stickLen, 5);

  // Stick body gradient
  const stickGrad = ctx.createLinearGradient(stickOffset, 0, stickOffset + stickLen, 0);
  stickGrad.addColorStop(0, '#f5deb3');
  stickGrad.addColorStop(0.1, '#ffe4b5');
  stickGrad.addColorStop(0.7, '#d2a86e');
  stickGrad.addColorStop(1, '#8b5e3c');
  ctx.fillStyle = stickGrad;

  // Tapered stick
  ctx.beginPath();
  ctx.moveTo(stickOffset, -2);
  ctx.lineTo(stickOffset + stickLen, -3.5);
  ctx.lineTo(stickOffset + stickLen, 3.5);
  ctx.lineTo(stickOffset, 2);
  ctx.closePath();
  ctx.fill();

  // Tip
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.arc(stickOffset, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Power indicator glow
  if (power > 0.3) {
    ctx.beginPath();
    ctx.arc(stickOffset, 0, 4 + power * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 107, 157, ${power * 0.4})`;
    ctx.fill();
  }

  ctx.restore();

  // Power bar under cue ball
  const barW = 40;
  const barH = 4;
  const barX = cueBall.x - barW / 2;
  const barY = cueBall.y + cueBall.r + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2);
  ctx.fill();

  const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  fillGrad.addColorStop(0, '#06d6a0');
  fillGrad.addColorStop(0.5, '#ffd166');
  fillGrad.addColorStop(1, '#ff6b9d');
  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * power, barH, 2);
  ctx.fill();
}

// =============================================
//  GAME LOGIC
// =============================================
function anyBallMoving() {
  return balls.some(b => !b.pocketed && b.isMoving);
}

function handleTurnEnd() {
  if (turnActive && !anyBallMoving()) {
    turnActive = false;

    // Check if cue ball was pocketed (scratch)
    if (cueBall.pocketed) {
      foulThisTurn = true;
      cueBall.pocketed = false;
      cueBall.x = BORDER + TABLE_W * 0.25;
      cueBall.y = BORDER + TABLE_H / 2;
      cueBall.vx = 0;
      cueBall.vy = 0;
    }

    // Assign types on first legal pocket
    const pocketedNums = ballsPocketedThisTurn.filter(b => b.num !== 0);

    if (playerTypes[1] === null && pocketedNums.length > 0 && !foulThisTurn) {
      const firstBall = pocketedNums[0];
      if (firstBall.isSolid) {
        playerTypes[currentPlayer] = 'solid';
        playerTypes[currentPlayer === 1 ? 2 : 1] = 'stripe';
      } else if (firstBall.isStripe) {
        playerTypes[currentPlayer] = 'stripe';
        playerTypes[currentPlayer === 1 ? 2 : 1] = 'solid';
      }
      updatePlayerUI();
    }

    // Check 8-ball pocketed
    const eightPocketed = pocketedNums.find(b => b.is8Ball);
    if (eightPocketed) {
      sfxVictory();
      // Check if player has cleared their balls
      const playerBallType = playerTypes[currentPlayer];
      const remaining = balls.filter(b => !b.pocketed && !b.is8Ball && b.num !== 0 &&
        (playerBallType === 'solid' ? b.isSolid : b.isStripe));

      if (remaining.length === 0 && !foulThisTurn) {
        showMessage(`Player ${currentPlayer} Wins! 🎉✨`);
      } else {
        // Sank 8-ball too early or on a foul
        const winner = currentPlayer === 1 ? 2 : 1;
        showMessage(`Player ${winner} Wins! 🎉✨`);
      }
      gameOver = true;
      if (endActionsContainer) endActionsContainer.style.display = 'flex';
      try {
        if (window.ArcadeLeaderboard) {
          window.ArcadeLeaderboard.submitScore('kawaii-8ball-pool', 800);
        }
      } catch(e){}
      return;
    }

    // Check if player pocketed their own ball (keep turn)
    let keepTurn = false;
    if (!foulThisTurn && pocketedNums.length > 0 && playerTypes[currentPlayer]) {
      const ownType = playerTypes[currentPlayer];
      keepTurn = pocketedNums.some(b =>
        (ownType === 'solid' && b.isSolid) || (ownType === 'stripe' && b.isStripe)
      );
    }

    if (!keepTurn || foulThisTurn) {
      // Switch player
      currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    updatePlayerUI();
    foulThisTurn = false;
    ballsPocketedThisTurn = [];
  }
}

function updatePlayerUI() {
  p1Panel.classList.toggle('active', currentPlayer === 1);
  p2Panel.classList.toggle('active', currentPlayer === 2);

  const solidEmoji = '🔴 Solids';
  const stripeEmoji = '🟡 Stripes';
  p1Type.textContent = playerTypes[1] === 'solid' ? solidEmoji : playerTypes[1] === 'stripe' ? stripeEmoji : '🎱';
  p2Type.textContent = playerTypes[2] === 'solid' ? solidEmoji : playerTypes[2] === 'stripe' ? stripeEmoji : '🎱';
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.className = 'show';
  messageEl.style.display = 'block';
}

// =============================================
// =============================================
//  INPUT (Pointer Capture & Window-Level Drag Tracking)
// =============================================
function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function handleStart(clientX, clientY, pointerId = null) {
  if (gameOver || turnActive) return;
  const pos = getCanvasCoords(clientX, clientY);

  // Check if clicking near cue ball
  if (cueBall && !cueBall.pocketed) {
    const dx = pos.x - cueBall.x;
    const dy = pos.y - cueBall.y;
    // Generous grab radius so it's easy to grab on mobile & desktop
    if (Math.sqrt(dx * dx + dy * dy) < cueBall.r + 35) {
      isDragging = true;
      dragStart.x = pos.x;
      dragStart.y = pos.y;
      dragEnd.x = pos.x;
      dragEnd.y = pos.y;
      aimHintEl.style.display = 'none';

      if (pointerId !== null && canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(pointerId);
        } catch (_) {}
      }
    }
  }
}

function handleMove(clientX, clientY) {
  if (!isDragging) return;
  const pos = getCanvasCoords(clientX, clientY);
  dragEnd.x = pos.x;
  dragEnd.y = pos.y;
}

function handleEnd(pointerId = null) {
  if (!isDragging) return;
  isDragging = false;

  if (pointerId !== null && canvas.releasePointerCapture) {
    try {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch (_) {}
  }

  const dx = dragStart.x - dragEnd.x;
  const dy = dragStart.y - dragEnd.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const power = Math.min(dist / 200, 1);

  if (power > 0.03 && cueBall && !cueBall.pocketed) {
    sfxCueHit(power);
    const angle = Math.atan2(dy, dx);
    const maxSpeed = 18;
    cueBall.vx = Math.cos(angle) * power * maxSpeed;
    cueBall.vy = Math.sin(angle) * power * maxSpeed;
    turnActive = true;
    ballsPocketedThisTurn = [];
    foulThisTurn = false;
  }
}

// Modern Unified Pointer Events with Window-Level Tracking
if (window.PointerEvent) {
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY, e.pointerId);
  }, { passive: false });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    handleEnd(e.pointerId);
  });

  window.addEventListener('pointercancel', (e) => {
    if (!isDragging) return;
    handleEnd(e.pointerId);
  });
} else {
  // Fallback for older browsers
  canvas.addEventListener('mousedown', (e) => {
    handleStart(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    handleEnd();
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) handleStart(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    handleEnd();
  });

  window.addEventListener('touchcancel', () => {
    if (!isDragging) return;
    handleEnd();
  });
}

// Play Again
playAgainBtn.addEventListener('click', () => {
  sfxClick();
  gameOver = false;
  currentPlayer = 1;
  playerTypes = { 1: null, 2: null };
  messageEl.style.display = 'none';
  messageEl.className = '';
  if (endActionsContainer) endActionsContainer.style.display = 'none';
  aimHintEl.style.display = 'block';
  updatePlayerUI();
  initBalls();
});

// =============================================
//  MAIN LOOP
// =============================================
let frameCount = 0;

function gameLoop() {
  frameCount++;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw table
  drawTable();

  // Update physics
  for (const ball of balls) {
    if (!ball.pocketed) {
      ball.update();
      checkPockets(ball);
    }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (!balls[i].pocketed && !balls[j].pocketed) {
        resolveCollision(balls[i], balls[j]);
      }
    }
  }

  // Draw balls (pocketed first as shadows in pockets, then active)
  for (const ball of balls) {
    ball.draw();
  }

  // Draw cue stick
  drawCueStick();

  // Update & draw sparkles
  sparkles = sparkles.filter(s => s.life > 0);
  for (const s of sparkles) {
    s.update();
    s.draw();
  }

  // Update & draw hearts
  hearts = hearts.filter(h => h.life > 0);
  for (const h of hearts) {
    h.update();
    h.draw();
  }

  // Ambient sparkles on the table (very subtle)
  if (frameCount % 30 === 0) {
    sparkles.push(new Sparkle(
      BORDER + Math.random() * TABLE_W,
      BORDER + Math.random() * TABLE_H,
      'rgba(255,255,255,0.5)'
    ));
  }

  // Check turn end
  handleTurnEnd();

  requestAnimationFrame(gameLoop);
}

// =============================================
//  RESPONSIVE CANVAS
// =============================================
function resizeCanvas() {
  const maxW = window.innerWidth * 0.92;
  const maxH = window.innerHeight * 0.72;
  const aspect = canvas.width / canvas.height;

  let displayW, displayH;
  if (maxW / aspect <= maxH) {
    displayW = maxW;
    displayH = maxW / aspect;
  } else {
    displayH = maxH;
    displayW = maxH * aspect;
  }

  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
}

window.addEventListener('resize', resizeCanvas);

// =============================================
//  START!
// =============================================
initBalls();
updatePlayerUI();
resizeCanvas();
gameLoop();
