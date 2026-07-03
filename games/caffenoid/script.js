window.addEventListener("DOMContentLoaded", () => {
    // ===== Elements =====
    const gameArea = document.querySelector(".game-area"), paddle = document.getElementById("paddle"), mainBall = document.getElementById("ball");
    const levelMenu = document.getElementById("levelMenu"), gameMessage = document.getElementById("gameMessage"), gameMessageText = document.getElementById("gameMessageText");
    const restartButton = document.getElementById("restartButton"), levelSelectButton = document.getElementById("levelSelectButton"), levelButtons = document.querySelectorAll(".level-button"), scoreText = document.getElementById("scoreText");

    // ===== Data =====
    const levels = [
        [
            "xxxbxxx", 
            "xxbvbxx", 
            "xbbbbbx",
            "bvbvbvb",
            "xbbbbbx",
            "xxbvbxx",
            "xxxbxxx",
        ],
        [
            "vvvvvvv", 
            "bxxyxxb", 
            "ooooooo",
            "bxyxyxb",
            "vvvvvvv",
            "bxxyxxb",
            "ooooooo",
        ],
        [
            "rrxoxrr", 
            "xyyyyyx", 
            "vxvxvxv", 
            "bbbbbbb",
            "vxvxvxv", 
            "xyyxyyx",
            "rrxoxrr", 
        ],
        [
            "xroyorx", 
            "xvxxxvx", 
            "xbxrxbx", 
            "xvxxxvx", 
            "xroyorx",
            "xxxxxxx",
            "royyyor", 
            "vxrxrxv", 
            "bxxrxxb", 
            "vxrxrxv", 
            "royyyor",
            "xxxxxxx",
            "xroyorx", 
            "xvxxxvx", 
            "xbxrxbx", 
            "xvxxxvx", 
            "xroyorx",

        ]
    ];
    const brickTypes = {
        b: { color: "blue", score: 50 }, v: { color: "violet", score: 75 }, y: { color: "yellow", score: 100 },
        o: { color: "orange", score: 125 }, r: { color: "red", score: 150 }
    };
    const bricks = [], balls = [], powerups = [];
    const ballSpeed = 5, powerupFallSpeed = 2, powerupSpawnChance = 0.5;
    const paddleDefaultWidth = 100, paddleMinWidth = 50, paddleMaxWidth = 200, paddleWidthStep = 50;
    let currentLevel = 0, isDragging = false, ballLaunched = false, gameRunning = false;
    let flameBallActive = false, flameTimer = null, score = 0;

    // ===== Classes =====
    class Brick {
        constructor(x, y, w, h, type) {
            Object.assign(this, { x, y, w, h, type, active: true, color: brickTypes[type].color, score: brickTypes[type].score });
            this.el = document.createElement("div");
            this.el.className = "brick";
            this.el.style.cssText = `width:${w}px;height:${h}px;background:${this.color}`;
            gameArea.appendChild(this.el);
            this.update();
        }
        update() { this.el.style.left = `${this.x}px`; this.el.style.top = `${this.y}px`; this.el.style.display = this.active ? "block" : "none"; }
        box() { return { left: this.x - this.w / 2, right: this.x + this.w / 2, top: this.y - this.h / 2, bottom: this.y + this.h / 2 }; }
        destroy() { this.active = false; this.update(); }
    }

    class PowerUp {
        constructor(x, y, type) {
            Object.assign(this, { x, y, type, w: 24, h: 24, active: true });
            this.el = document.createElement("div");
            this.el.className = `powerup ${type}`;
            gameArea.appendChild(this.el);
            this.update();
        }
        update() { this.el.style.left = `${this.x}px`; this.el.style.top = `${this.y}px`; }
        box() { return { left: this.x - this.w / 2, right: this.x + this.w / 2, top: this.y - this.h / 2, bottom: this.y + this.h / 2 }; }
        destroy() { this.active = false; this.el.remove(); }
    }

    class Ball {
        constructor(el, x, y, vx = 0, vy = 0) {
            Object.assign(this, { el, x, y, vx, vy, active: true });
            if (flameBallActive) this.el.classList.add("flame-ball");
            this.update();
        }
        update() { this.el.style.left = `${this.x}px`; this.el.style.top = `${this.y}px`; }
        destroy() {
            this.active = false;
            if (this.el === mainBall) { this.el.style.display = "none"; this.el.classList.remove("flame-ball"); }
            else this.el.remove();
        }
    }

    // ===== Helpers =====
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
    const rectBox = r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const boxHit = (a, b) => a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
    const clearList = (list, removeFn) => { for (const item of list) removeFn(item); list.length = 0; };
    const clearEffects = () => document.querySelectorAll(".explosion-piece").forEach(e => e.remove());

    function circleBoxHit(b, box) {
        const r = b.el.offsetWidth / 2, x = clamp(b.x, box.left, box.right), y = clamp(b.y, box.top, box.bottom);
        return (b.x - x) ** 2 + (b.y - y) ** 2 <= r ** 2;
    }

    function clearBalls() {
        for (const b of balls) if (b.el !== mainBall) b.el.remove();
        balls.length = 0;
        mainBall.classList.remove("flame-ball");
        mainBall.style.display = "none";
    }

    function setBallAngle(b, deg) {
        const rad = deg * Math.PI / 180;
        b.vx = Math.cos(rad) * ballSpeed;
        b.vy = Math.sin(rad) * ballSpeed;
    }

    // ===== Score / Paddle =====
    function scoreMultiplier() {
        const w = Math.round(paddle.getBoundingClientRect().width);
        return w >= 200 ? 0.8 : w >= 150 ? 0.9 : w >= 100 ? 1.0 : 1.2;
    }

    function updateScore() { scoreText.textContent = `Score: ${score}  x${scoreMultiplier().toFixed(1)}`; }
    function addScore(points) { score += Math.round(points * scoreMultiplier()); updateScore(); }
    function centerPaddle() { paddle.style.left = `${window.innerWidth / 2}px`; }

    function setPaddleWidth(w) {
        paddle.style.width = `${clamp(w, paddleMinWidth, paddleMaxWidth)}px`;
        const r = paddle.getBoundingClientRect();
        paddle.style.left = `${clamp(r.left + r.width / 2, r.width / 2, window.innerWidth - r.width / 2)}px`;
        if (!ballLaunched) placeMainBallOnPaddle();
        updateScore();
    }

    function movePaddle(x) {
        const r = paddle.getBoundingClientRect();
        paddle.style.left = `${clamp(x, r.width / 2, window.innerWidth - r.width / 2)}px`;
        if (!ballLaunched) placeMainBallOnPaddle();
    }

    // ===== Balls =====
    function placeMainBallOnPaddle() {
        if (!balls[0]) return;
        const pr = paddle.getBoundingClientRect(), r = mainBall.offsetWidth / 2;
        balls[0].x = pr.left + pr.width / 2;
        balls[0].y = pr.top - r;
        balls[0].update();
    }

    function resetBalls() {
        clearBalls();
        mainBall.style.display = "block";
        balls.push(new Ball(mainBall, window.innerWidth / 2, window.innerHeight * 0.9 - 20));
    }

    function launchBall() {
        if (ballLaunched || !gameRunning || !balls[0]) return;
        ballLaunched = true;
        setBallAngle(balls[0], -45);
    }

    function addExtraBall() {
        if (!ballLaunched || !balls.some(b => b.active)) return;
        const src = balls.find(b => b.active), el = document.createElement("div");
        el.className = flameBallActive ? "ball flame-ball" : "ball";
        gameArea.appendChild(el);
        const b = new Ball(el, src.x, src.y);
        setBallAngle(b, -135 + Math.random() * 90);
        balls.push(b);
    }

    function activateFlameBall() {
        flameBallActive = true;
        balls.forEach(b => b.el.classList.add("flame-ball"));
        if (flameTimer) clearTimeout(flameTimer);
        flameTimer = setTimeout(() => {
            flameBallActive = false;
            balls.forEach(b => b.el.classList.remove("flame-ball"));
            flameTimer = null;
        }, 5000);
    }

    // ===== Collisions =====
    function resolveBrickBounce(b, box) {
        const r = b.el.offsetWidth / 2, bb = { left: b.x - r, right: b.x + r, top: b.y - r, bottom: b.y + r };
        const ol = bb.right - box.left, or = box.right - bb.left, ot = bb.bottom - box.top, ob = box.bottom - bb.top;
        if (Math.min(ol, or) < Math.min(ot, ob)) { b.x = ol < or ? box.left - r : box.right + r; b.vx *= -1; return; }
        b.y = ot < ob ? box.top - r : box.bottom + r;
        b.vy *= -1;
    }

    function checkPaddleCollision(b) {
        const pr = paddle.getBoundingClientRect(), box = rectBox(pr);
        if (!circleBoxHit(b, box) || b.vy <= 0) return;
        b.y = box.top - b.el.offsetWidth / 2;
        const section = Math.floor((b.x - pr.left) / (pr.width / 5));
        setBallAngle(b, section <= 0 ? -135 : section === 1 ? -115 : section === 2 ? -90 : section === 3 ? -65 : -45);
    }

    function checkBrickCollisions(b) {
        for (const brick of bricks) {
            if (!brick.active || !circleBoxHit(b, brick.box())) continue;
            if (!flameBallActive) resolveBrickBounce(b, brick.box());
            createBrickExplosion(brick);
            if (Math.random() < powerupSpawnChance) spawnRandomPowerup(brick.x, brick.y);
            brick.destroy();
            addScore(brick.score);
            if (bricks.every(br => !br.active)) endGame("You Win!");
            break;
        }
    }

    // ===== Effects / Powerups =====
    function createBrickExplosion(brick) {
        const w = brick.w / 2, h = brick.h / 2;
        for (const [ox, oy, dx, dy] of [[-w / 2, -h / 2, "-22px", "-18px"], [w / 2, -h / 2, "22px", "-18px"], [-w / 2, h / 2, "-22px", "18px"], [w / 2, h / 2, "22px", "18px"]]) {
            const p = document.createElement("div");
            p.className = "explosion-piece";
            p.style.cssText = `left:${brick.x + ox}px;top:${brick.y + oy}px;width:${w}px;height:${h}px`;
            p.style.setProperty("--dx", dx);
            p.style.setProperty("--dy", dy);
            p.style.setProperty("--piece-color", brick.color);
            gameArea.appendChild(p);
            p.addEventListener("animationend", () => p.remove());
        }
    }

    function spawnRandomPowerup(x, y) {
        const types = ["flame", "grow", "shrink", "addball"];
        powerups.push(new PowerUp(x, y, types[Math.floor(Math.random() * types.length)]));
    }

    function applyPowerup(type) {
        if (type === "flame") activateFlameBall();
        else if (type === "grow") setPaddleWidth(paddle.getBoundingClientRect().width + paddleWidthStep);
        else if (type === "shrink") setPaddleWidth(paddle.getBoundingClientRect().width - paddleWidthStep);
        else if (type === "addball") addExtraBall();
    }

    // ===== Level / State =====
    function showGameObjects(show) {
        paddle.style.display = show ? "block" : "none";
        mainBall.style.display = show ? "block" : "none";
        scoreText.style.display = show ? "block" : "none";
    }

    function cleanRuntimeObjects() {
        if (flameTimer) clearTimeout(flameTimer);
        flameTimer = null;
        flameBallActive = false;
        clearList(bricks, b => b.el.remove());
        clearList(powerups, p => p.el.remove());
        clearBalls();
        clearEffects();
    }

    function showLevelMenu() {
        gameRunning = false;
        ballLaunched = false;
        cleanRuntimeObjects();
        showGameObjects(false);
        gameMessage.style.display = "none";
        levelMenu.style.display = "block";
    }

    function startLevel(index) {
        currentLevel = index;
        gameRunning = true;
        ballLaunched = false;
        isDragging = false;
        score = 0;
        cleanRuntimeObjects();

        levelMenu.style.display = "none";
        gameMessage.style.display = "none";
        gameMessageText.textContent = "";

        resetBalls();
        showGameObjects(true);
        setPaddleWidth(paddleDefaultWidth);
        centerPaddle();
        placeMainBallOnPaddle();
        updateScore();
        createLevel(levels[currentLevel]);
        updateGame();
    }

    function endGame(message) {
        gameRunning = false;
        ballLaunched = false;
        gameMessageText.textContent = message;
        gameMessage.style.display = "block";
    }

    function createLevel(map) {
        const w = 50, h = 20, gap = 8, cols = map[0].length;
        const startX = window.innerWidth / 2 - (cols * w + (cols - 1) * gap) / 2 + w / 2;
        const startY = window.innerHeight * 0.12;
        for (let row = 0; row < map.length; row++) for (let col = 0; col < cols; col++) {
            const tile = map[row][col];
            if (brickTypes[tile]) bricks.push(new Brick(startX + col * (w + gap), startY + row * (h + gap), w, h, tile));
        }
    }

    // ===== Update =====
    function updateBalls() {
        const r = mainBall.offsetWidth / 2;
        for (const b of balls) {
            if (!b.active) continue;
            b.x += b.vx; b.y += b.vy;

            if (b.x - r <= 0) { b.x = r; b.vx *= -1; }
            if (b.x + r >= window.innerWidth) { b.x = window.innerWidth - r; b.vx *= -1; }
            if (b.y - r <= 0) { b.y = r; b.vy *= -1; }

            checkBrickCollisions(b);
            checkPaddleCollision(b);

            if (b.y + r >= window.innerHeight) { b.destroy(); continue; }
            b.update();
        }

        for (let i = balls.length - 1; i >= 0; i--) if (!balls[i].active && balls[i].el !== mainBall) balls.splice(i, 1);
        if (!balls.some(b => b.active)) endGame("Game Over!");
    }

    function updatePowerups() {
        const paddleBox = rectBox(paddle.getBoundingClientRect());
        for (const p of powerups) {
            if (!p.active) continue;
            p.y += powerupFallSpeed;
            p.update();

            if (boxHit(p.box(), paddleBox)) { applyPowerup(p.type); p.destroy(); continue; }
            if (p.box().top >= window.innerHeight) p.destroy();
        }
    }

    function updateGame() {
        if (!gameRunning) return;
        if (ballLaunched) updateBalls();
        updatePowerups();
        requestAnimationFrame(updateGame);
    }

    // ===== Input =====
window.addEventListener("pointerdown", e => {
    if (e.target.tagName === "BUTTON" || !gameRunning) return;

    isDragging = true;
    movePaddle(e.clientX);
    launchBall();
});

window.addEventListener("pointermove", e => {
    if (!isDragging || !gameRunning) return;
    movePaddle(e.clientX);
});

window.addEventListener("pointerup", () => isDragging = false);
window.addEventListener("pointercancel", () => isDragging = false);

window.addEventListener("resize", () => {
    if (!ballLaunched && gameRunning) {
        centerPaddle();
        placeMainBallOnPaddle();
    }
});

restartButton.addEventListener("pointerdown", e => {
    e.stopPropagation();
    startLevel(currentLevel);
});

levelSelectButton.addEventListener("pointerdown", e => {
    e.stopPropagation();
    showLevelMenu();
});

levelButtons.forEach(btn => btn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    startLevel(Number(btn.dataset.level));
}));

    // ===== Start =====
    showLevelMenu();
});