(() => {
  "use strict";

  const canvas = document.getElementById("birdCanvas");
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

  let width = 960, height = 540, running = false, dead = false, lastTime = 0;
  let elapsed = 0, score = 0, speed = 190, soundOn = true, audioCtx = null;
  let flash = 0, shake = 0;
  let best = Number(localStorage.getItem("sigma67-bird-best") || 0);
  bestScoreEl.textContent = String(best);

  const bird = { x:160, y:220, size:34, vy:0, gravity:980, flapPower:360, rotation:0 };
  const pipes = [], particles = [], stars = [];

  const messages = [
    "AIRSPACE DENIED",
    "GRAVITY IS A HATER",
    "FLAP RESPONSIBLY",
    "BIRD BRAIN ONLINE",
    "WHO GAVE IT WINGS",
    "AERODYNAMICALLY SUS",
    "TOO MUCH SKY",
    "WING IT",
    "TURBULENCE ERA",
    "UNLICENSED AVIATION",
    "SKY WIFI DISCONNECTED",
    "FEATHERS IN THE MAINFRAME",
    "THIS BIRD HAS DEBT",
    "ALTITUDE: QUESTIONABLE",
    "NO FLY ZONE? LOL",
    "FLAP TAX DUE",
    "BIRD.exe IS RUNNING",
    "EMOTIONAL SUPPORT WINGS",
    "THE SKY KNOWS TOO MUCH",
    "FLY NOW THINK LATER",
    "ABSOLUTE AIRHEAD",
    "PIGEON ENERGY",
    "WINGS BEFORE THINGS",
    "AIR TRAFFIC IS CONFUSED",
    "DO NOT LOOK DOWN",
    "SKY GREMLIN ACTIVE",
    "CLIPPED BY ATMOSPHERE",
    "CERTIFIED FLAP INCIDENT"
  ];

  let currentMessage = randomMessage();
  let nextMessageAt = 2;

  function randomMessage(previous = "") {
    let candidate = previous;
    while (candidate === previous) candidate = messages[Math.floor(Math.random() * messages.length)];
    return candidate;
  }

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < 85; i++) stars.push({x:Math.random()*width,y:Math.random()*height,size:Math.random()*2+.5,speed:Math.random()*.35+.08});
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = width * 9 / 16;
    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    canvas.style.height = `${height}px`;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    bird.x = Math.max(85, width * .17);
    bird.size = Math.max(28, Math.min(38, width * .038));
    if (!running) bird.y = height * .46;
    initStars();
  }

  function initAudio() {
    if (!soundOn) return;
    if (!audioCtx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) audioCtx = new A();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq,duration,type="square",volume=.03) {
    if (!soundOn) return;
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.start(now); osc.stop(now + duration);
  }

  function resetGame() {
    running = true; dead = false; lastTime = performance.now(); elapsed = 0; score = 0;
    speed = Math.max(165, width * .19); flash = 0; shake = 0;
    pipes.length = 0; particles.length = 0;
    bird.y = height * .46; bird.vy = 0; bird.rotation = 0;
    currentMessage = randomMessage(currentMessage);
    nextMessageAt = 1.4 + Math.random() * 1.8;
    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    statusText.textContent = "FLAPPING";
    spawnPipe(width + 170);
    requestAnimationFrame(loop);
  }

  function flap() {
    if (!running || dead) return;
    bird.vy = -bird.flapPower;
    beep(560,.055,"square",.025);
    for (let i=0;i<5;i++) particles.push({x:bird.x-bird.size*.25,y:bird.y+bird.size*.55,vx:-70-Math.random()*80,vy:(Math.random()-.5)*90,life:.25+Math.random()*.25,color:i%2?"#49f6ff":"#d7ff52"});
  }

  function action() { initAudio(); if (!running || dead) { resetGame(); return; } flap(); }

  function spawnPipe(x) {
    const gap = Math.max(118, height * .255);
    const margin = Math.max(55, height * .10);
    const minCenter = margin + gap/2, maxCenter = height - margin - gap/2;
    const center = minCenter + Math.random() * (maxCenter - minCenter);
    pipes.push({x, width:Math.max(52,width*.060), gapTop:center-gap/2, gapBottom:center+gap/2, scored:false});
  }

  function hitsPipe(pipe) {
    const bx=bird.x+5, by=bird.y+5, bw=bird.size-10, bh=bird.size-10;
    const overlapsX = bx < pipe.x + pipe.width && bx + bw > pipe.x;
    if (!overlapsX) return false;
    return by < pipe.gapTop || by + bh > pipe.gapBottom;
  }

  function die() {
    dead = true; running = false; flash = 1; shake = 12;
    beep(110,.30,"sawtooth",.055);
    for (let i=0;i<30;i++) particles.push({x:bird.x+bird.size/2,y:bird.y+bird.size/2,vx:(Math.random()-.5)*450,vy:(Math.random()-.5)*360,life:.45+Math.random()*.7,color:i%3===0?"#ff3bf4":i%2?"#49f6ff":"#d7ff52"});
    if (score > best) { best = score; localStorage.setItem("sigma67-bird-best", String(best)); bestScoreEl.textContent = String(best); }
    finalScore.textContent = `SCORE: ${score} // BEST: ${best}`;
    statusText.textContent = "CRASHED";
    setTimeout(()=>gameOverOverlay.classList.remove("hidden"),400);
  }

  function update(dt) {
    elapsed += dt; speed += dt * 1.8;
    if (elapsed >= nextMessageAt) { currentMessage = randomMessage(currentMessage); nextMessageAt = elapsed + 2 + Math.random() * 2.6; }
    bird.vy += bird.gravity * dt; bird.y += bird.vy * dt;
    const target = Math.max(-.55, Math.min(1.15, bird.vy/460));
    bird.rotation += (target - bird.rotation) * Math.min(1, dt*8);
    if (pipes.length === 0 || pipes[pipes.length-1].x < width - Math.max(250,width*.34)) spawnPipe(width+50);
    for (let i=pipes.length-1;i>=0;i--) {
      const p=pipes[i]; p.x -= speed*dt;
      if (!p.scored && p.x+p.width < bird.x) { p.scored=true; score++; beep(780,.05,"square",.02); }
      if (p.x+p.width < -80) { pipes.splice(i,1); continue; }
      if (hitsPipe(p)) { die(); return; }
    }
    if (bird.y < -bird.size*.2 || bird.y+bird.size > height) { die(); return; }
    for (const s of stars) { s.x -= speed*dt*s.speed; if (s.x < -4) { s.x = width + Math.random()*90; s.y = Math.random()*height; } }
    for (let i=particles.length-1;i>=0;i--) { const p=particles[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; if (p.life<=0) particles.splice(i,1); }
    if (flash>0) flash=Math.max(0,flash-dt*4.2);
    if (shake>0) shake=Math.max(0,shake-dt*30);
  }

  function drawBackground() {
    const grad=ctx.createLinearGradient(0,0,width,height);
    grad.addColorStop(0,"#030306"); grad.addColorStop(.55,"#071018"); grad.addColorStop(1,"#09020d");
    ctx.fillStyle=grad; ctx.fillRect(0,0,width,height);
    ctx.globalAlpha=.68;
    for (const s of stars) { ctx.fillStyle=s.size>1.7?"#d7ff52":"#667"; ctx.fillRect(s.x,s.y,s.size,s.size); }
    ctx.globalAlpha=1;
    ctx.strokeStyle="rgba(73,246,255,.10)"; ctx.lineWidth=1;
    const horizon=height*.78, offset=-(elapsed*speed*.12)%55;
    for (let x=offset;x<width;x+=55) { ctx.beginPath(); ctx.moveTo(width/2+(x-width/2)*.25,horizon); ctx.lineTo(x,height); ctx.stroke(); }
    for (let y=horizon;y<height;y+=24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
    const maxFont=Math.max(30,width*.065);
    const scale=currentMessage.length>22?.62:currentMessage.length>16?.76:1;
    ctx.globalAlpha=.12; ctx.fillStyle="#d7ff52"; ctx.font=`bold ${maxFont*scale}px monospace`; ctx.textAlign="center";
    ctx.fillText(currentMessage,width*.64,height*.28,width*.62);
    ctx.globalAlpha=1; ctx.textAlign="left";
  }

  function drawPipeRect(x,y,w,h,top) {
    ctx.fillStyle="#0a0a0a"; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle="#49f6ff"; ctx.lineWidth=3; ctx.strokeRect(x,y,w,h);
    ctx.fillStyle="rgba(73,246,255,.12)";
    for (let yy=y+8;yy<y+h;yy+=18) ctx.fillRect(x+6,yy,w-12,5);
    const capH=12; ctx.fillStyle="#ff3bf4"; ctx.fillRect(x-7,top?y+h-capH:y,w+14,capH);
  }

  function drawPipes() { for (const p of pipes) { drawPipeRect(p.x,0,p.width,p.gapTop,true); drawPipeRect(p.x,p.gapBottom,p.width,height-p.gapBottom,false); } }

  function drawBird() {
    ctx.save(); ctx.translate(bird.x+bird.size/2,bird.y+bird.size/2); ctx.rotate(bird.rotation);
    const s=bird.size; ctx.shadowColor="#d7ff52"; ctx.shadowBlur=16; ctx.fillStyle="#d7ff52"; ctx.fillRect(-s/2,-s/2,s,s); ctx.shadowBlur=0;
    ctx.fillStyle="#050505"; ctx.fillRect(s*.05,-s*.18,s*.14,s*.14);
    ctx.fillStyle="#ff3bf4"; ctx.fillRect(s*.34,-s*.02,s*.30,s*.16);
    ctx.fillStyle="#49f6ff"; ctx.fillRect(-s*.48,s*.05,s*.25,s*.16);
    ctx.restore();
  }

  function drawParticles() { for (const p of particles) { ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.8)); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); } ctx.globalAlpha=1; }
  function drawHUD() { ctx.fillStyle="#f4f4f4"; ctx.font=`bold ${Math.max(14,width*.019)}px monospace`; ctx.fillText(`SCORE ${score.toString().padStart(3,"0")}`,18,30); ctx.fillStyle="#8e8e8e"; ctx.font=`${Math.max(10,width*.012)}px monospace`; ctx.fillText(`AIR ${Math.round(speed)}`,18,48); }

  function draw() {
    ctx.save();
    if (shake>0) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    drawBackground(); drawPipes(); drawBird(); drawParticles(); drawHUD();
    if (flash>0) { ctx.fillStyle=`rgba(255,255,255,${flash*.42})`; ctx.fillRect(0,0,width,height); }
    ctx.restore();
  }

  function loop(now) {
    if (!running) { draw(); return; }
    const dt=Math.min(.032,(now-lastTime)/1000||0); lastTime=now; update(dt); draw();
    if (running) requestAnimationFrame(loop);
  }

  startButton.addEventListener("click",action);
  restartButton.addEventListener("click",action);
  soundButton.addEventListener("click",()=>{ soundOn=!soundOn; soundButton.textContent=soundOn?"SOUND: ON":"SOUND: OFF"; soundButton.setAttribute("aria-pressed",String(soundOn)); if(soundOn)beep(620,.06); });
  canvas.addEventListener("pointerdown",e=>{e.preventDefault();action();});
  window.addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();action();}});
  window.addEventListener("resize",resize);
  resize(); draw();
})();
