const soundToggle = document.getElementById("soundToggle");
const siteNav = document.getElementById("main-nav");
const welcomePortal = document.getElementById("welcome-portal");
const welcomeLoop = document.getElementById("welcome-video-loop");
const welcomeContent = document.getElementById("welcome-content");
const welcomeAudioHint = document.getElementById("welcome-audio-hint");
const enterPortalButton = document.getElementById("enter-portal-btn");
const filmHero = document.getElementById("filmHero");
const heroStudioVideo = document.getElementById("heroStudioVideo");

let isPortalEntering = false;
let welcomeNeedsGestureForAudio = false;
let welcomeUnlockBound = false;
let heroPlaybackEnabled = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateNavState() {
  if (!siteNav) return;
  siteNav.classList.toggle("nav-scrolled", window.scrollY > 30);
}

function setupWelcomePortal() {
  if (!welcomePortal) return;

  document.body.classList.add("portal-active");
  bindWelcomeAudioUnlock();

  if (welcomeLoop) {
    welcomeLoop.defaultMuted = true;
    welcomeLoop.muted = true;
    welcomeLoop.volume = 0;
    welcomeLoop.currentTime = 0;
    welcomeNeedsGestureForAudio = true;
    welcomeAudioHint?.classList.add("is-visible");
    welcomeLoop.play().catch(() => {});
  }

  enterPortalButton?.addEventListener("click", enterExperience);
}

function bindWelcomeAudioUnlock() {
  if (welcomeUnlockBound) return;
  window.addEventListener("pointerdown", unlockWelcomeAudio, { passive: true });
  window.addEventListener("keydown", unlockWelcomeAudio, { passive: true });
  welcomeUnlockBound = true;
}

function cleanupWelcomeAudioUnlock() {
  if (!welcomeUnlockBound) return;
  window.removeEventListener("pointerdown", unlockWelcomeAudio);
  window.removeEventListener("keydown", unlockWelcomeAudio);
  welcomeUnlockBound = false;
}

async function unlockWelcomeAudio() {
  if (!welcomeLoop || !welcomeNeedsGestureForAudio || isPortalEntering) return;

  try {
    welcomeLoop.muted = false;
    welcomeLoop.volume = 1;
    await welcomeLoop.play();
    welcomeNeedsGestureForAudio = false;
    welcomeAudioHint?.classList.remove("is-visible");
  } catch {
    // Keep the opening running silently if the browser still blocks sound.
  }
}

function enterExperience() {
  if (isPortalEntering) return;
  isPortalEntering = true;
  cleanupWelcomeAudioUnlock();
  welcomeAudioHint?.classList.remove("is-visible");
  welcomeContent?.classList.add("is-hidden");
  startHeroExperienceMedia();

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

function setupReveals() {
  const items = document.querySelectorAll(".reveal");
  if (reduceMotion) {
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

function setupSound() {
  if (!soundToggle) return;
  soundToggle.textContent = "Opening Audio";
  soundToggle.setAttribute("aria-pressed", "false");
  soundToggle.addEventListener("click", unlockWelcomeAudio);
}

function setupFilmHero() {
  if (!filmHero) return;

  if (heroStudioVideo) {
    heroStudioVideo.pause();
    heroStudioVideo.muted = true;
    heroStudioVideo.volume = 0;
    heroStudioVideo.currentTime = 0;
  }

  if (reduceMotion) return;

  const resetHeroMotion = () => {
    filmHero.style.setProperty("--hero-pointer-x", "50%");
    filmHero.style.setProperty("--hero-pointer-y", "50%");
    filmHero.style.setProperty("--hero-shift-x", "0px");
    filmHero.style.setProperty("--hero-shift-y", "0px");
  };

  filmHero.addEventListener("pointermove", (event) => {
    const rect = filmHero.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const shiftX = (x - 0.5) * -18;
    const shiftY = (y - 0.5) * -14;

    filmHero.style.setProperty("--hero-pointer-x", `${(x * 100).toFixed(2)}%`);
    filmHero.style.setProperty("--hero-pointer-y", `${(y * 100).toFixed(2)}%`);
    filmHero.style.setProperty("--hero-shift-x", `${shiftX.toFixed(2)}px`);
    filmHero.style.setProperty("--hero-shift-y", `${shiftY.toFixed(2)}px`);
  });

  filmHero.addEventListener("pointerleave", resetHeroMotion);

  if (typeof IntersectionObserver === "function") {
    const heroObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry || !heroStudioVideo || !heroPlaybackEnabled) return;

      if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
        playHeroFromCurrentTime();
        return;
      }

      heroStudioVideo.pause();
    }, {
      threshold: [0, 0.35, 0.55],
    });

    heroObserver.observe(filmHero);
  }
}

function startHeroExperienceMedia() {
  if (!heroStudioVideo) return;
  heroPlaybackEnabled = true;

  try {
    heroStudioVideo.currentTime = 0;
  } catch {
    // Some browsers block seeking before metadata is ready.
  }

  playHeroFromCurrentTime();
}

function playHeroFromCurrentTime() {
  if (!heroStudioVideo) return;

  heroStudioVideo.muted = false;
  heroStudioVideo.volume = 1;
  heroStudioVideo.play().catch(() => {
    heroStudioVideo.muted = true;
    heroStudioVideo.volume = 0;
    heroStudioVideo.play().catch(() => {});
  });
}

setupWelcomePortal();
setupReveals();
setupTrackingCards();
setupDeltaSlider();
setupSound();
setupFilmHero();
updateNavState();

window.addEventListener("scroll", updateNavState, { passive: true });
window.addEventListener("pageshow", () => {
  if (!welcomePortal || isPortalEntering) return;
  welcomeLoop?.play().catch(() => {});
  if (document.body.classList.contains("portal-active")) {
    heroStudioVideo?.pause();
    if (heroStudioVideo) heroStudioVideo.currentTime = 0;
    return;
  }
  if (heroPlaybackEnabled) {
    playHeroFromCurrentTime();
  }
});
