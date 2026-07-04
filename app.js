const TARGET_FPS = 60;
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;
const SCROLL_PIXELS_PER_FRAME = 5;

const video = document.getElementById("sourceVideo");
const frameAudio = document.getElementById("frameAudio");
const canvas = document.getElementById("frameCanvas");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
const hero = document.querySelector(".scroll-hero");
const scrollSpace = document.getElementById("scrollSpace");
const frameReadout = document.getElementById("frameReadout");
const progressReadout = document.getElementById("progressReadout");
const railFill = document.getElementById("railFill");
const soundToggle = document.getElementById("soundToggle");
const siteNav = document.getElementById("main-nav");
const scrollPanels = Array.from(document.querySelectorAll(".story-card"));
const welcomePortal = document.getElementById("welcome-portal");
const welcomeLoop = document.getElementById("welcome-video-loop");
const welcomeContent = document.getElementById("welcome-content");
const enterPortalButton = document.getElementById("enter-portal-btn");

let duration = 24;
let totalFrames = duration * TARGET_FPS;
let targetFrame = 0;
let currentHeroProgress = 0;
let displayedFrame = 0;
let seekFrame = -1;
let waitingForSeek = false;
let canDraw = false;
let audioContext = null;
let audioBuffer = null;
let activeAudioSource = null;
let audioGain = null;
let audioMode = "none";
let soundEnabled = false;
let audioLoading = false;
let lastAudioFrame = -1;
let lastAudioAt = 0;
let lastFallbackSeekAt = 0;
let lastScrollY = window.scrollY;
let lastScrollAt = performance.now();
let isPortalEntering = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeScrollSpace() {
  const frameHeight = Math.max(window.innerHeight * 6, totalFrames * SCROLL_PIXELS_PER_FRAME);
  scrollSpace.style.height = `${Math.round(frameHeight)}px`;
}

function heroProgress() {
  const start = hero.offsetTop;
  const end = start + hero.offsetHeight - window.innerHeight;
  return clamp((window.scrollY - start) / Math.max(1, end - start), 0, 1);
}

function updateTargetFrame() {
  currentHeroProgress = heroProgress();
  targetFrame = Math.round(currentHeroProgress * (totalFrames - 1));
  if (railFill) railFill.style.height = `${Math.round(currentHeroProgress * 100)}%`;
  if (progressReadout) progressReadout.textContent = `${String(Math.round(currentHeroProgress * 100)).padStart(2, "0")}%`;
}

function updateScrollNarrative(progress) {
  if (!scrollPanels.length) return;

  const firstCenter = 0.15;
  const lastCenter = 0.88;
  const step = scrollPanels.length > 1 ? (lastCenter - firstCenter) / (scrollPanels.length - 1) : 0;

  scrollPanels.forEach((panel, index) => {
    const center = firstCenter + step * index;
    const rawDistance = progress - center;
    const distance = Math.abs(rawDistance);
    const opacity = clamp(1 - distance / 0.11, 0, 1);
    const lift = rawDistance < 0 ? (1 - opacity) * 38 : (1 - opacity) * -52;
    const reveal = clamp(1 - distance / 0.14, 0, 1);

    panel.style.opacity = String(opacity);
    panel.style.setProperty("--story-lift", `${lift}px`);
    panel.style.setProperty("--story-reveal", reveal.toFixed(3));
    panel.classList.toggle("active", opacity > 0.08);
  });
}

function updateNavState() {
  if (!siteNav) return;
  siteNav.classList.toggle("nav-scrolled", window.scrollY > 30);
}

function setupStoryCardTilt() {
  if (!scrollPanels.length) return;

  scrollPanels.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (!card.classList.contains("active")) return;

      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      card.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      card.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
      card.style.setProperty("--mx", `${(x / rect.width) * 100}%`);
      card.style.setProperty("--my", `${(y / rect.height) * 100}%`);
      card.classList.add("is-hovered");
    });

    const resetTilt = () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.classList.remove("is-hovered");
    };

    card.addEventListener("pointerleave", resetTilt);
    card.addEventListener("pointerup", resetTilt);
    card.addEventListener("pointercancel", resetTilt);
  });
}

function setupWelcomePortal() {
  if (!welcomePortal) return;

  document.body.classList.add("portal-active");

  if (welcomeLoop) {
    welcomeLoop.defaultMuted = false;
    welcomeLoop.muted = false;
    welcomeLoop.volume = 1;

    welcomeLoop.addEventListener("loadedmetadata", () => {
      welcomeLoop.currentTime = 0;
      welcomeLoop.play().catch(() => {});
    }, { once: true });

    try {
      welcomeLoop.currentTime = 0;
      welcomeLoop.play().catch(() => {});
    } catch {
      // Some browsers delay playback until media is ready.
    }
  }

  window.enterExperience = enterExperience;
  enterPortalButton?.addEventListener("click", enterExperience);
}

function enterExperience() {
  if (isPortalEntering) return;
  isPortalEntering = true;

  welcomeContent?.classList.add("is-hidden");

  if (welcomeLoop) {
    welcomeLoop.muted = true;
    welcomeLoop.volume = 0;
  }

  window.setTimeout(() => {
    welcomePortal?.classList.add("is-exiting");
    document.body.classList.remove("portal-active");

    window.setTimeout(() => {
      if (welcomePortal) welcomePortal.style.display = "none";
      welcomeLoop?.pause();
    }, 720);
  }, 420);
}

function markScrollActivity() {
  if (Math.abs(window.scrollY - lastScrollY) > 0.5) {
    lastScrollY = window.scrollY;
    lastScrollAt = performance.now();
  }
}

function drawFrame() {
  if (!canDraw || !video.videoWidth || !video.videoHeight) return;

  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = TARGET_WIDTH / TARGET_HEIGHT;
  let drawWidth = TARGET_WIDTH;
  let drawHeight = TARGET_HEIGHT;
  let drawX = 0;
  let drawY = 0;

  if (videoRatio > canvasRatio) {
    drawHeight = TARGET_HEIGHT;
    drawWidth = drawHeight * videoRatio;
    drawX = (TARGET_WIDTH - drawWidth) / 2;
  } else {
    drawWidth = TARGET_WIDTH;
    drawHeight = drawWidth / videoRatio;
    drawY = (TARGET_HEIGHT - drawHeight) / 2;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
  if (frameReadout) frameReadout.textContent = String(Math.round(displayedFrame)).padStart(4, "0");
}

function requestFrame(frame) {
  if (waitingForSeek || frame === seekFrame) return;
  seekFrame = frame;
  const time = clamp(frame / TARGET_FPS, 0, Math.max(0, duration - 0.001));

  if (Math.abs(video.currentTime - time) < 0.002) {
    displayedFrame = frame;
    canDraw = true;
    drawFrame();
    return;
  }

  waitingForSeek = true;

  if ("fastSeek" in video) video.fastSeek(time);
  else video.currentTime = time;
}

function tick() {
  updateTargetFrame();
  updateScrollNarrative(currentHeroProgress);
  markScrollActivity();
  displayedFrame += (targetFrame - displayedFrame) * 0.24;
  requestFrame(Math.round(displayedFrame));
  syncFrameAudio(Math.round(displayedFrame));
  requestAnimationFrame(tick);
}

video.addEventListener("loadedmetadata", () => {
  duration = video.duration || duration;
  totalFrames = Math.max(1, Math.round(duration * TARGET_FPS));
  resizeScrollSpace();
  updateTargetFrame();
});

video.addEventListener("loadeddata", () => {
  canDraw = true;
  drawFrame();
});

video.addEventListener("seeked", () => {
  displayedFrame = seekFrame;
  waitingForSeek = false;
  canDraw = true;
  drawFrame();
});

function setupReveals() {
  const items = document.querySelectorAll(".reveal");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    items.forEach((item) => item.classList.add("active"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  items.forEach((item) => observer.observe(item));
}

function setupTrackingCards() {
  document.querySelectorAll(".tracking-card").forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--y", `${event.clientY - rect.top}px`);
    });
  });
}

function setupDeltaSlider() {
  const slider = document.getElementById("ba-slider");
  const overlay = document.getElementById("ba-overlay");
  const handle = slider?.querySelector(".delta-handle");
  if (!slider || !overlay || !handle) return;

  const setPosition = (clientX) => {
    const rect = slider.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const percent = (x / rect.width) * 100;
    overlay.style.width = `${percent}%`;
    handle.style.left = `${percent}%`;
  };

  slider.addEventListener("pointerdown", (event) => {
    slider.setPointerCapture(event.pointerId);
    setPosition(event.clientX);
  });
  slider.addEventListener("pointermove", (event) => {
    if (event.buttons) setPosition(event.clientX);
  });
}

async function setupSound() {
  if (!soundToggle) return;

  soundToggle.addEventListener("click", async () => {
    if (!soundEnabled) {
      soundToggle.textContent = "Loading";
      soundToggle.disabled = true;
      let ready = false;
      try {
        ready = await unlockAudio();
      } finally {
        soundToggle.disabled = false;
        soundEnabled = ready;
        soundToggle.setAttribute("aria-pressed", String(soundEnabled));
        soundToggle.textContent = soundEnabled ? "Sound On" : "Sound Off";
        soundToggle.classList.toggle("is-on", soundEnabled);
      }
      return;
    }

    soundEnabled = false;
    stopActiveAudio();
    stopFallbackAudio();
    soundToggle.setAttribute("aria-pressed", "false");
    soundToggle.textContent = "Sound Off";
    soundToggle.classList.remove("is-on");
  });
}

function withTimeout(promise, delay) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Audio startup timed out.")), delay);
    }),
  ]);
}

async function unlockAudio() {
  const fallbackReady = await unlockFallbackAudio();
  if (fallbackReady) return true;
  return false;
}

async function unlockFallbackAudio() {
  if (!frameAudio) return false;

  try {
    frameAudio.volume = 0.55;
    frameAudio.muted = false;
    frameAudio.load();
    frameAudio.currentTime = clamp(Math.round(displayedFrame) / TARGET_FPS, 0, Math.max(0, duration - 0.1));
    const playPromise = frameAudio.play();
    if (playPromise) await withTimeout(playPromise, 1400);
    frameAudio.pause();
    audioMode = "media";
    return true;
  } catch (error) {
    console.warn("Audio could not be enabled.", error);
    return false;
  }
}

function stopActiveAudio() {
  if (!activeAudioSource) return;
  try {
    activeAudioSource.stop();
  } catch {
    // Source may already have ended.
  }
  activeAudioSource = null;
}

function stopFallbackAudio() {
  if (!frameAudio) return;
  frameAudio.pause();
}

function syncFrameAudio(frame) {
  if (!soundEnabled) return;

  const now = performance.now();
  const isScrolling = now - lastScrollAt < 180;
  if (!isScrolling) {
    stopActiveAudio();
    stopFallbackAudio();
    return;
  }

  if (audioMode === "media") {
    syncFallbackAudio(frame, now);
    return;
  }

  if (!audioContext || !audioBuffer || audioContext.state !== "running") return;

  if (Math.abs(frame - lastAudioFrame) < 2 && now - lastAudioAt < 58) return;

  stopActiveAudio();
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const offset = clamp(frame / TARGET_FPS, 0, Math.max(0, audioBuffer.duration - 0.08));
  const sliceDuration = 0.115;

  source.buffer = audioBuffer;
  gain.gain.setValueAtTime(0, audioContext.currentTime);
  gain.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.018);
  gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + sliceDuration);
  source.connect(gain);
  gain.connect(audioGain);
  source.start(audioContext.currentTime, offset, sliceDuration);
  source.onended = () => {
    if (activeAudioSource === source) activeAudioSource = null;
  };

  activeAudioSource = source;
  lastAudioFrame = frame;
  lastAudioAt = now;
}

function syncFallbackAudio(frame, now) {
  if (!frameAudio) return;

  const offset = clamp(frame / TARGET_FPS, 0, Math.max(0, duration - 0.1));
  if (Math.abs(frameAudio.currentTime - offset) > 0.08 && now - lastFallbackSeekAt > 80) {
    frameAudio.currentTime = offset;
    lastFallbackSeekAt = now;
  }

  if (frameAudio.paused) {
    frameAudio.play().catch(() => {
      soundEnabled = false;
      soundToggle?.classList.remove("is-on");
      soundToggle?.setAttribute("aria-pressed", "false");
      if (soundToggle) soundToggle.textContent = "Sound Off";
    });
  }
}

canvas.width = TARGET_WIDTH;
canvas.height = TARGET_HEIGHT;
video.pause();
resizeScrollSpace();
setupReveals();
setupTrackingCards();
setupDeltaSlider();
setupSound();
setupWelcomePortal();
setupStoryCardTilt();
updateNavState();

window.addEventListener("resize", resizeScrollSpace, { passive: true });
window.addEventListener("scroll", () => {
  updateTargetFrame();
  updateNavState();
}, { passive: true });
requestAnimationFrame(tick);
