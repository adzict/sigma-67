(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const soundButton = document.getElementById("soundButton");
  const finalScore = document.getElementById("finalScore");
  const bestScoreEl = document.getElementById("bestScore");
  const statusText = document.getElementById("statusText");

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let width = 960;
  let height = 540;
  let floorY = 430;

  let running = false;
  let dead = false;
  let lastTime = 0;
  let elapsed = 0;
  let distance = 0;
  let score = 0;
  let speed = 310;
  let spawnTimer = 0;
  let nextSpawn = 1.15;
  let shake = 0;
  let flash = 0;
  let soundOn = true;
  let audioCtx = null;
  let best = Number(localStorage.getItem("sigma67-best") || 0);

  bestScoreEl.textContent = String(best);

  const player = {
    x: 120,
    y: 0,
    size: 36,
    vy: 0,
    gravity: 1800,
    jumpPower: 660,
    grounded: true,
    rotation: 0
  };

  const obstacles = [];
  const particles = [];
  const stars = [];

  /*
    The game picks a RANDOM phrase every few seconds.
    Song references are intentionally kept to very short snippets/titles.
    The extra fishy / brainrot lines are original.
  */
  const messages = [
    // Original SIGMA67 messages
    "KEEP GOING",
    "NO SIGNAL",
    "67",
    "SIGMA?",
    "DON'T PANIC",
    "STILL HERE",
    "AGAIN",
    "GOOD.",

    // Fishy brainrot
    "FISHY GOT THAT DRIP",
    "FISHY IN FULL DRIP MODE",
    "THE FISH HAS LORE",
    "FISHY SAID NO CAP",
    "CERTIFIED FISH MOMENT",
    "AQUATIC RIZZ DETECTED",

    // Very short song nods
    "WAKA WAKA",
    "THIS TIME FOR AFRICA",
    "TSAMINA MINA",
    "MISS YOU",
    "I DON'T EVER WANNA SEE YOU",
    "LIFE GOES ON",
    "ON AND ON",

    // Inside jokes
    "KO JE PRDNUO",
    "NATASA JE PRDNULA",
    "EZRA JE PRDNUO",
    "DIMI JE PRDNUO",
    "TANJA NIKAD NE PRDI",
    "KO CE ICI PO FRIZBI",

    // More brainrot
    "ABSOLUTELY NO CONTEXT",
    "SIDE QUEST ACTIVATED",
    "LORE JUST DROPPED",
    "RIZZ LEVEL: UNSTABLE",
    "BRAINROT DETECTED",
    "THIS IS FINE",
    "WHO APPROVED THIS",
    "VERY NORMAL BEHAVIOUR",
    "ZERO THOUGHTS",
    "FULL SEND",
    "MAIN CHARACTER ERROR",
    "THE VIBES ARE QUESTIONABLE"
  ];

  let currentMessage = randomMessage();
  let nextMessageAt = 2.4;

  function randomMessage(previous = "") {
    if (messages.length === 1) return messages[0];

    let candidate = previous;

    while (candidate === previous) {
      candidate = messages[Math.floor(Math.random() * messages.length)];
    }

    return candidate;
  }

  function initStars() {
    stars.length = 0;

    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * (floorY - 40),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.4 + 0.1
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    width = Math.max(320, rect.width);
    height = width * 9 / 16;

    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    canvas.style.height = `${height}px`;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    floorY = height * 0.79;
    player.size = Math.max(28, Math.min(40, width * 0.038));
    player.x = Math.max(72, width * 0.13);

    if (!running) {
      player.y = floorY - player.size;
    }

    initStars();
  }

  function resetGame() {
    running = true;
    dead = false;
    elapsed = 0;
    distance = 0;
    score = 0;
    speed = Math.max(280, width * 0.32);
    spawnTimer = 0;
    nextSpawn = 1.1;
    shake = 0;
    flash = 0;

    currentMessage = randomMessage(currentMessage);
    nextMessageAt = 1.6 + Math.random() * 2.0;

    obstacles.length = 0;
    particles.length = 0;

    player.y = floorY - player.size;
    player.vy = 0;
    player.grounded = true;
    player.rotation = 0;

    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    statusText.textContent = "RUNNING";

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function initAudio() {
    if (!soundOn) return;

    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }

    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function beep(freq, duration, type = "square", volume = 0.035) {
    if (!soundOn) return;

    initAudio();

    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }

  function jump() {
    if (!running || dead) return;

    if (player.grounded) {
      player.vy = -player.jumpPower;
      player.grounded = false;

      beep(420, 0.08, "square", 0.03);

      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x + player.size * 0.5,
          y: floorY - 3,
          vx: -80 - Math.random() * 120,
          vy: -20 - Math.random() * 80,
          life: 0.35 + Math.random() * 0.25,
          color: i % 2 ? "#49f6ff" : "#ff3bf4"
        });
      }
    }
  }

  function handlePrimaryAction() {
    initAudio();

    if (!running || dead) {
      resetGame();
      return;
    }

    jump();
  }

  function spawnObstacle() {
    const choice = Math.random();
    const baseX = width + 50;

    if (choice < 0.52) {
      const count = Math.random() < 0.28 ? 2 : 1;
      const size = Math.max(28, player.size * 0.88);

      for (let i = 0; i < count; i++) {
        obstacles.push({
          type: "spike",
          x: baseX + i * (size * 0.82),
          y: floorY,
          w: size,
          h: size,
          passed: false
        });
      }
    } else if (choice < 0.82) {
      const w = player.size * 1.15;
      const h = player.size * (0.9 + Math.random() * 1.05);

      obstacles.push({
        type: "block",
        x: baseX,
        y: floorY - h,
        w,
        h,
        passed: false
      });
    } else {
      const size = Math.max(26, player.size * 0.8);

      obstacles.push({
        type: "spike",
        x: baseX,
        y: floorY,
        w: size,
        h: size,
        passed: false
      });

      obstacles.push({
        type: "spike",
        x: baseX + size * 1.9,
        y: floorY,
        w: size,
        h: size,
        passed: false
      });
    }
  }

  function update(dt) {
    elapsed += dt;
    distance += speed * dt;
    score = Math.floor(distance / 35);

    // Random background phrase every ~2.2–5.0 seconds.
    if (elapsed >= nextMessageAt) {
      currentMessage = randomMessage(currentMessage);
      nextMessageAt = elapsed + 2.2 + Math.random() * 2.8;
    }

    speed += dt * 5.2;

    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    if (player.y + player.size >= floorY) {
      player.y = floorY - player.size;
      player.vy = 0;
      player.grounded = true;
      player.rotation =
        Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
    } else {
      player.rotation += dt * 5.8;
    }

    spawnTimer += dt;

    if (spawnTimer >= nextSpawn) {
      spawnTimer = 0;
      spawnObstacle();

      const difficulty = Math.min(0.38, elapsed * 0.004);
      nextSpawn = 0.95 + Math.random() * 0.85 - difficulty;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];

      o.x -= speed * dt;

      if (!o.passed && o.x + o.w < player.x) {
        o.passed = true;
        beep(720, 0.035, "square", 0.012);
      }

      if (o.x + o.w < -80) {
        obstacles.splice(i, 1);
        continue;
      }

      if (collides(player, o)) {
        die();
        return;
      }
    }

    for (const star of stars) {
      star.x -= speed * dt * star.speed;

      if (star.x < -4) {
        star.x = width + Math.random() * 80;
        star.y = Math.random() * (floorY - 40);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 450 * dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    if (shake > 0) {
      shake = Math.max(0, shake - dt * 28);
    }

    if (flash > 0) {
      flash = Math.max(0, flash - dt * 4);
    }
  }

  function collides(p, o) {
    const px = p.x + 5;
    const py = p.y + 5;
    const pw = p.size - 10;
    const ph = p.size - 10;

    if (o.type === "block") {
      return (
        px < o.x + o.w &&
        px + pw > o.x &&
        py < o.y + o.h &&
        py + ph > o.y
      );
    }

    const sx = o.x + o.w * 0.18;
    const sy = o.y - o.h * 0.82;
    const sw = o.w * 0.64;
    const sh = o.h * 0.82;

    return (
      px < sx + sw &&
      px + pw > sx &&
      py < sy + sh &&
      py + ph > sy
    );
  }

  function die() {
    dead = true;
    running = false;
    shake = 12;
    flash = 1;

    beep(120, 0.28, "sawtooth", 0.06);

    for (let i = 0; i < 28; i++) {
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        vx: (Math.random() - 0.5) * 520,
        vy: (Math.random() - 0.65) * 420,
        life: 0.5 + Math.random() * 0.65,
        color:
          i % 3 === 0
            ? "#d7ff52"
            : i % 2
            ? "#49f6ff"
            : "#ff3bf4"
      });
    }

    if (score > best) {
      best = score;
      localStorage.setItem("sigma67-best", String(best));
      bestScoreEl.textContent = String(best);
    }

    finalScore.textContent = `SCORE: ${score} // BEST: ${best}`;
    statusText.textContent = "SIGNAL LOST";

    setTimeout(() => {
      gameOverOverlay.classList.remove("hidden");
    }, 420);
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    drawBackground();
    drawWorld();
    drawPlayer();
    drawParticles();
    drawHUD();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.45})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, width, height);

    grad.addColorStop(0, "#030306");
    grad.addColorStop(0.55, "#080312");
    grad.addColorStop(1, "#020607");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.65;

    for (const star of stars) {
      ctx.fillStyle = star.size > 1.7 ? "#49f6ff" : "#777";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;

    const horizon = floorY - 20;

    ctx.strokeStyle = "rgba(73,246,255,0.12)";
    ctx.lineWidth = 1;

    const gridOffset = -(distance * 0.28) % 60;

    for (let x = gridOffset; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(
        width / 2 + (x - width / 2) * 0.2,
        horizon
      );
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = horizon; y < height; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Background brainrot text.
    // Shrinks slightly for long phrases so they stay inside the game area.
    const maxFont = Math.max(34, width * 0.075);
    const lengthScale =
      currentMessage.length > 22
        ? 0.62
        : currentMessage.length > 16
        ? 0.76
        : 1;

    ctx.globalAlpha = 0.11;
    ctx.fillStyle = "#ff3bf4";
    ctx.font = `bold ${maxFont * lengthScale}px monospace`;
    ctx.textAlign = "center";

    ctx.fillText(
      currentMessage,
      width * 0.67,
      height * 0.35,
      width * 0.60
    );

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawWorld() {
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, floorY, width, height - floorY);

    ctx.fillStyle = "#49f6ff";
    ctx.fillRect(0, floorY, width, 3);

    for (const o of obstacles) {
      if (o.type === "spike") {
        ctx.beginPath();
        ctx.moveTo(o.x, floorY);
        ctx.lineTo(o.x + o.w / 2, floorY - o.h);
        ctx.lineTo(o.x + o.w, floorY);
        ctx.closePath();

        ctx.fillStyle = "#ff3bf4";
        ctx.fill();

        ctx.strokeStyle = "#ffd3fb";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "#0c0c0c";
        ctx.fillRect(o.x, o.y, o.w, o.h);

        ctx.strokeStyle = "#d7ff52";
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x, o.y, o.w, o.h);

        ctx.fillStyle = "rgba(215,255,82,0.18)";

        const stripe = 9;

        for (let y = o.y + 7; y < o.y + o.h; y += stripe * 2) {
          ctx.fillRect(
            o.x + 5,
            y,
            o.w - 10,
            stripe / 2
          );
        }
      }
    }
  }

  function drawPlayer() {
    ctx.save();

    ctx.translate(
      player.x + player.size / 2,
      player.y + player.size / 2
    );

    ctx.rotate(player.rotation);

    ctx.shadowColor = "#49f6ff";
    ctx.shadowBlur = 18;

    ctx.fillStyle = "#49f6ff";
    ctx.fillRect(
      -player.size / 2,
      -player.size / 2,
      player.size,
      player.size
    );

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#050505";

    const eye = player.size * 0.13;
    const eyeY = -player.size * 0.08;

    ctx.fillRect(
      -player.size * 0.25,
      eyeY,
      eye,
      eye
    );

    ctx.fillRect(
      player.size * 0.12,
      eyeY,
      eye,
      eye
    );

    ctx.fillRect(
      -player.size * 0.18,
      player.size * 0.2,
      player.size * 0.36,
      Math.max(3, player.size * 0.07)
    );

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha =
        Math.max(0, Math.min(1, p.life * 1.7));

      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 5, 5);
    }

    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = "#f4f4f4";
    ctx.font =
      `bold ${Math.max(14, width * 0.019)}px monospace`;

    ctx.fillText(
      `SCORE ${score.toString().padStart(5, "0")}`,
      18,
      30
    );

    ctx.fillStyle = "#8e8e8e";
    ctx.font =
      `${Math.max(10, width * 0.012)}px monospace`;

    ctx.fillText(
      `SPEED ${Math.round(speed)}`,
      18,
      48
    );
  }

  function loop(now) {
    if (!running) {
      draw();
      return;
    }

    const dt =
      Math.min(0.032, (now - lastTime) / 1000 || 0);

    lastTime = now;

    update(dt);
    draw();

    if (running) {
      requestAnimationFrame(loop);
    }
  }

  startButton.addEventListener(
    "click",
    handlePrimaryAction
  );

  restartButton.addEventListener(
    "click",
    handlePrimaryAction
  );

  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;

    soundButton.textContent =
      soundOn ? "SOUND: ON" : "SOUND: OFF";

    soundButton.setAttribute(
      "aria-pressed",
      String(soundOn)
    );

    if (soundOn) {
      beep(520, 0.06);
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handlePrimaryAction();
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" ||
      event.code === "ArrowUp"
    ) {
      event.preventDefault();
      handlePrimaryAction();
    }
  });

  window.addEventListener("resize", resize);

  resize();
  draw();
})();
