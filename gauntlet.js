(() => {
  "use strict";

  const canvas = document.getElementById("gauntletCanvas");
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
  let running = false;
  let dead = false;
  let lastTime = 0;
  let elapsed = 0;
  let distance = 0;
  let speed = 0.24;
  let spawnTimer = 0;
  let nextSpawn = 1.15;
  let flash = 0;
  let shake = 0;
  let musicOn = true;
  let best = Number(localStorage.getItem("sigma67-gauntlet-best") || 0);

  bestScoreEl.textContent = String(best);

  const player = {
    state: "run",
    actionTimer: 0
  };

  const projectiles = [];
  const dust = [];

  const messages = [
    "TEMPLE WIFI WEAK",
    "SPEAR DELIVERY",
    "DUCK OR REGRET IT",
    "ANCIENT PATCH NOTES",
    "NO REFUNDS",
    "THE WALLS ARE JUDGING",
    "RITUAL BUFFERING",
    "RUN FIRST ASK LATER",
    "ARCHAEOLOGY BUT LOUD",
    "CURSED FITNESS TEST",
    "SOMEBODY CALL HISTORY",
    "STONE AGE SPEEDRUN",
    "TEMPLE HAS OPINIONS",
    "THIS SEEMS UNSAFE",
    "ANCIENT RIZZ TRIAL",
    "SPEAR INCOMING LOL",
    "DO NOT TRIP NOW",
    "THE GODS ARE LAGGING"
  ];

  let currentMessage = randomMessage();
  let nextMessageAt = 2.0;

  /* ---------------- ORIGINAL SID-LIKE MUSIC ----------------
     This is an original WebAudio chiptune written for SIGMA67.
     It does not reproduce the original Aztec Challenge music.
  ---------------------------------------------------------- */

  let audioCtx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;

  const bassPattern = [45,45,48,43,45,50,48,43, 45,45,52,50,48,43,41,43];
  const leadPattern = [69,72,76,72, 67,69,72,67, 65,67,69,72, 74,72,69,67];

  function midiToHz(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;

      audioCtx = new A();
      master = audioCtx.createGain();
      master.gain.value = 0.11;
      master.connect(audioCtx.destination);
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function chipNote(freq, start, duration, type, volume) {
    if (!audioCtx || !master || !musicOn) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1900, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noiseHit(start, volume = 0.025) {
    if (!audioCtx || !master || !musicOn) return;

    const len = Math.floor(audioCtx.sampleRate * 0.04);
    const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();

    src.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);

    src.connect(gain);
    gain.connect(master);

    src.start(start);
  }

  function startMusic() {
    ensureAudio();

    if (!audioCtx || musicTimer) return;

    musicStep = 0;

    musicTimer = setInterval(() => {
      if (!musicOn || !audioCtx) return;

      const now = audioCtx.currentTime + 0.02;
      const i = musicStep % bassPattern.length;

      chipNote(midiToHz(bassPattern[i]), now, 0.16, "square", 0.13);

      if (musicStep % 2 === 0) {
        chipNote(
          midiToHz(leadPattern[(musicStep / 2) % leadPattern.length]),
          now,
          0.11,
          "sawtooth",
          0.055
        );
      }

      if (musicStep % 4 === 0 || musicStep % 4 === 2) {
        noiseHit(now, musicStep % 4 === 0 ? 0.045 : 0.024);
      }

      musicStep++;
    }, 145);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function oneShot(freq, dur = 0.06, type = "square", vol = 0.05) {
    ensureAudio();
    if (!audioCtx || !master || !musicOn) return;
    chipNote(freq, audioCtx.currentTime, dur, type, vol);
  }

  function randomMessage(previous = "") {
    let candidate = previous;
    while (candidate === previous) {
      candidate = messages[Math.floor(Math.random() * messages.length)];
    }
    return candidate;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = width * 9 / 16;

    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    canvas.style.height = `${height}px`;

    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function resetGame() {
    running = true;
    dead = false;
    elapsed = 0;
    distance = 0;
    speed = 0.24;
    spawnTimer = 0;
    nextSpawn = 1.0;
    flash = 0;
    shake = 0;

    player.state = "run";
    player.actionTimer = 0;

    projectiles.length = 0;
    dust.length = 0;

    currentMessage = randomMessage(currentMessage);
    nextMessageAt = 1.5 + Math.random() * 1.8;

    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    statusText.textContent = "RUNNING";

    startMusic();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function act(state) {
    if (!running || dead) return;

    player.state = state;
    player.actionTimer = 0.48;

    oneShot(
      state === "jump" ? 680 : 260,
      0.055,
      "square",
      0.035
    );
  }

  function spawnProjectile() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const kindRoll = Math.random();

    const required =
      kindRoll < 0.5
        ? "jump"
        : "duck";

    projectiles.push({
      side,
      depth: 0.02,
      lane: side,
      required,
      hit: false
    });
  }

  function update(dt) {
    elapsed += dt;
    distance += dt * 34;
    speed = Math.min(0.52, 0.24 + elapsed * 0.0032);

    if (elapsed >= nextMessageAt) {
      currentMessage = randomMessage(currentMessage);
      nextMessageAt = elapsed + 2.1 + Math.random() * 2.6;
    }

    if (player.actionTimer > 0) {
      player.actionTimer -= dt;

      if (player.actionTimer <= 0) {
        player.state = "run";
      }
    }

    spawnTimer += dt;

    if (spawnTimer >= nextSpawn) {
      spawnTimer = 0;
      spawnProjectile();

      nextSpawn =
        Math.max(
          0.62,
          1.18 - elapsed * 0.004
        ) + Math.random() * 0.42;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      p.depth += dt * speed;

      if (!p.hit && p.depth >= 0.92) {
        p.hit = true;

        if (player.state !== p.required) {
          die();
          return;
        } else {
          oneShot(870, 0.035, "square", 0.025);
        }
      }

      if (p.depth > 1.12) {
        projectiles.splice(i,1);
      }
    }

    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life -= dt;
      d.y -= d.vy * dt;
      d.x += d.vx * dt;

      if (d.life <= 0) dust.splice(i,1);
    }

    if (Math.random() < dt * 14) {
      dust.push({
        x: width * 0.5 + (Math.random() - 0.5) * width * 0.18,
        y: height * 0.82,
        vx: (Math.random() - 0.5) * 24,
        vy: 22 + Math.random() * 20,
        life: 0.4 + Math.random() * 0.5
      });
    }

    if (flash > 0) flash = Math.max(0, flash - dt * 4);
    if (shake > 0) shake = Math.max(0, shake - dt * 32);
  }

  function die() {
    dead = true;
    running = false;
    flash = 1;
    shake = 14;

    oneShot(95, 0.3, "sawtooth", 0.11);
    stopMusic();

    const rounded = Math.floor(distance);

    if (rounded > best) {
      best = rounded;
      localStorage.setItem("sigma67-gauntlet-best", String(best));
      bestScoreEl.textContent = String(best);
    }

    finalScore.textContent =
      `DISTANCE: ${rounded} // BEST: ${best}`;

    statusText.textContent = "SPEARED";

    setTimeout(() => {
      gameOverOverlay.classList.remove("hidden");
    }, 420);
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(
        (Math.random() - .5) * shake,
        (Math.random() - .5) * shake
      );
    }

    drawWorld();
    drawProjectiles();
    drawPlayer();
    drawDust();
    drawHUD();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * .42})`;
      ctx.fillRect(0,0,width,height);
    }

    ctx.restore();
  }

  function drawWorld() {
    const grad = ctx.createLinearGradient(0,0,0,height);
    grad.addColorStop(0, "#120707");
    grad.addColorStop(.55, "#060606");
    grad.addColorStop(1, "#170b04");

    ctx.fillStyle = grad;
    ctx.fillRect(0,0,width,height);

    const horizonY = height * .30;
    const cx = width * .5;

    // temple
    ctx.fillStyle = "#20130b";
    const templeW = width * .18;
    const templeH = height * .17;
    ctx.fillRect(
      cx - templeW/2,
      horizonY - templeH * .70,
      templeW,
      templeH
    );

    ctx.fillStyle = "#ffcf55";
    ctx.globalAlpha = .14;
    ctx.fillRect(
      cx - templeW * .16,
      horizonY - templeH * .35,
      templeW * .32,
      templeH * .65
    );
    ctx.globalAlpha = 1;

    // perspective road
    ctx.fillStyle = "#0b0806";
    ctx.beginPath();
    ctx.moveTo(cx - width * .055, horizonY);
    ctx.lineTo(cx + width * .055, horizonY);
    ctx.lineTo(width * .90, height);
    ctx.lineTo(width * .10, height);
    ctx.closePath();
    ctx.fill();

    // perspective lines
    ctx.strokeStyle = "rgba(255,207,85,.18)";
    ctx.lineWidth = 1;

    const phase = (distance * .035) % 1;

    for (let i = 0; i < 18; i++) {
      const t = (i + phase) / 18;
      const p = t * t;
      const y = horizonY + p * (height - horizonY);

      const half =
        width * (.055 + p * .395);

      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }

    for (const side of [-1,1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * width * .055, horizonY);
      ctx.lineTo(cx + side * width * .395, height);
      ctx.stroke();
    }

    // background text
    const maxFont = Math.max(28, width * .055);
    const scale =
      currentMessage.length > 20 ? .68 :
      currentMessage.length > 14 ? .80 : 1;

    ctx.globalAlpha = .10;
    ctx.fillStyle = "#ff4a2e";
    ctx.font = `bold ${maxFont * scale}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(
      currentMessage,
      width * .5,
      height * .19,
      width * .78
    );
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function projectPoint(side, depth) {
    const horizonY = height * .30;
    const cx = width * .5;
    const p = depth * depth;

    const y = horizonY + p * (height - horizonY);
    const half = width * (.06 + p * .42);
    const x = cx + side * half;

    return {x,y,p};
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      const pos = projectPoint(p.side, p.depth);

      const size =
        5 + pos.p * 68;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      const targetX = width * .5 - pos.x;
      const targetY = height * .76 - pos.y;
      const angle = Math.atan2(targetY, targetX);

      ctx.rotate(angle);

      ctx.strokeStyle =
        p.required === "jump"
          ? "#ff4a2e"
          : "#49f6ff";

      ctx.lineWidth =
        Math.max(2, size * .09);

      ctx.beginPath();
      ctx.moveTo(-size * .8, 0);
      ctx.lineTo(size * .8, 0);
      ctx.stroke();

      ctx.fillStyle = "#ffcf55";
      ctx.beginPath();
      ctx.moveTo(size * .8,0);
      ctx.lineTo(size * .48,-size * .16);
      ctx.lineTo(size * .48,size * .16);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  function drawPlayer() {
    const cx = width * .5;
    const groundY = height * .83;

    let bodyY = groundY;
    let bodyH = Math.max(44, height * .12);

    if (player.state === "jump") {
      bodyY -= height * .11;
    }

    if (player.state === "duck") {
      bodyH *= .57;
      bodyY += height * .055;
    }

    ctx.save();

    ctx.strokeStyle = "#f4f4f4";
    ctx.fillStyle = "#ffcf55";
    ctx.lineWidth = 3;

    // head
    const headR = Math.max(8, bodyH * .13);
    ctx.beginPath();
    ctx.arc(
      cx,
      bodyY - bodyH * .72,
      headR,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // torso
    ctx.beginPath();
    ctx.moveTo(cx, bodyY - bodyH * .58);
    ctx.lineTo(cx, bodyY - bodyH * .12);
    ctx.stroke();

    // arms
    ctx.beginPath();
    ctx.moveTo(cx, bodyY - bodyH * .45);
    ctx.lineTo(cx - bodyH * .27, bodyY - bodyH * .28);
    ctx.moveTo(cx, bodyY - bodyH * .45);
    ctx.lineTo(cx + bodyH * .27, bodyY - bodyH * .28);
    ctx.stroke();

    // legs
    ctx.beginPath();
    ctx.moveTo(cx, bodyY - bodyH * .12);
    ctx.lineTo(cx - bodyH * .22, bodyY);
    ctx.moveTo(cx, bodyY - bodyH * .12);
    ctx.lineTo(cx + bodyH * .22, bodyY);
    ctx.stroke();

    ctx.restore();
  }

  function drawDust() {
    ctx.globalAlpha = .42;
    ctx.fillStyle = "#ffcf55";

    for (const d of dust) {
      ctx.fillRect(d.x,d.y,3,3);
    }

    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    const d = Math.floor(distance);

    ctx.fillStyle = "#f4f4f4";
    ctx.font = `bold ${Math.max(14, width * .019)}px monospace`;
    ctx.fillText(
      `DIST ${String(d).padStart(4,"0")}`,
      18,
      30
    );

    ctx.fillStyle = "#8e8e8e";
    ctx.font = `${Math.max(10, width * .012)}px monospace`;
    ctx.fillText(
      player.state.toUpperCase(),
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
      Math.min(.032, (now - lastTime) / 1000 || 0);

    lastTime = now;

    update(dt);
    draw();

    if (running) {
      requestAnimationFrame(loop);
    }
  }

  startButton.addEventListener("click", () => {
    ensureAudio();
    resetGame();
  });

  restartButton.addEventListener("click", () => {
    ensureAudio();
    resetGame();
  });

  soundButton.addEventListener("click", () => {
    musicOn = !musicOn;

    soundButton.textContent =
      musicOn ? "MUSIC: ON" : "MUSIC: OFF";

    soundButton.setAttribute(
      "aria-pressed",
      String(musicOn)
    );

    if (musicOn && running) {
      startMusic();
    } else {
      stopMusic();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.code === "ArrowUp" ||
      event.code === "KeyW"
    ) {
      event.preventDefault();

      if (!running) {
        ensureAudio();
        resetGame();
      } else {
        act("jump");
      }
    }

    if (
      event.code === "ArrowDown" ||
      event.code === "KeyS"
    ) {
      event.preventDefault();

      if (!running) {
        ensureAudio();
        resetGame();
      } else {
        act("duck");
      }
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    if (!running) {
      ensureAudio();
      resetGame();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;

    act(
      y < rect.height * .52
        ? "jump"
        : "duck"
    );
  });

  window.addEventListener("resize", resize);

  resize();
  draw();
})();
