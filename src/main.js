import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import typingWavUrl from "../assets/typing.wav";
import darkModeToggleWavUrl from "../assets/darkmodetoggle.wav";

const galleryModules = import.meta.glob(
  [
    "../assets/optimized/self1/*.webp",
    "../assets/optimized/project1/*.webp",
    "../assets/optimized/project2/*.webp",
    "../assets/optimized/relevantexperience1/*.webp",
    "../assets/optimized/relevantexperience2/*.webp",
  ],
  { eager: true, import: "default" },
);

const galleryImages = {};
Object.entries(galleryModules).forEach(([path, url]) => {
  const parts = path.split("/");
  const group = parts[parts.length - 2];
  const name = parts[parts.length - 1];
  if (!group) return;
  (galleryImages[group] ||= []).push({ name, url });
});
Object.values(galleryImages).forEach((slides) => {
  slides.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
});

gsap.registerPlugin(ScrollTrigger);
// Mobile toolbars change innerHeight while scrolling; re-measuring then shifts pinned content.
ScrollTrigger.config({ ignoreMobileResize: true });

/* ------------------------------------------------------------------
   Intro / interaction settings
   ------------------------------------------------------------------ */
const INTRO = {
  typeSpeed: 55, // ms per character
  linePause: 380, // pause between the name and the tagline
  keyVolume: 0.24, // keystroke sample volume
  minLoad: 3000, // minimum progress run in ms
};

const MAGNET = {
  group: 3, // max px shared by a section group
  extra: 1, // extra px for the nearest image/button
  baseInfluence: 0.4, // distant groups still lean slightly
  ease: 12, // higher is quicker to settle
};

const SOUND = {
  toggleVolume: 0.45,
  clickVolume: 0.3,
  clickRate: 0.75,
};

const THEME_REVEAL = 700; // ms

/* ------------------------------------------------------------------
   Scroll zoom settings
   ------------------------------------------------------------------ */
const ZOOM = {
  center: { x: 0.4997, y: 0.2935 },
  display: { width: 0.6758, height: 0.5098 },
  scroll: 1.6,
  mobileScroll: 0.95,
  smoothing: true,
  overscan: 1.03,
};

const DESKTOP_MOTION = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const root = document.documentElement;
const main = document.querySelector("main");
const hero = document.querySelector(".hero");
const head = document.querySelector(".hero__head");
const heroIntro = document.querySelector(".hero__intro");
const socials = document.querySelector(".hero .socials");
const scrollHint = document.querySelector(".hero__scroll-hint");
const laptop = document.querySelector(".laptop");
const laptopImg = document.querySelector(".laptop__img");
const laptopScreen = document.querySelector(".laptop__screen");
const portal = document.querySelector(".hero-portal");
const portalStage = document.querySelector(".hero-portal__stage");
const work = document.querySelector(".work");
const track = document.querySelector(".work__track");
const lcdTexture = document.querySelector(".lcd-texture");
const lcdVignette = document.querySelector(".lcd-vignette");
const lcdPlane = document.querySelector(".lcd-texture__plane");
const loader = document.querySelector(".loader");
const loaderPercent = document.querySelector(".loader__percent");
const loaderPercentInner = document.querySelector(".loader__percent .magnet-inner");
const loaderBar = document.querySelector(".loader__bar");
const soundToggle = document.querySelector(".sound-toggle");
const themeToggle = document.querySelector(".theme-toggle");
const titleTyped = document.querySelector(".hero__title .hero__typed");
const taglineTyped = document.querySelector(".hero__tagline .hero__typed");

let heroPin = null;
let locked = true;
let caret = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setLcdFade = (value) => root.style.setProperty("--lcd-fade", value);

function positionMobileIntro() {
  if (!heroIntro) return;

  if (!window.matchMedia("(max-width: 899px)").matches) {
    heroIntro.style.position = "";
    heroIntro.style.top = "";
    return;
  }

  heroIntro.style.position = "relative";
  heroIntro.style.top = "0px";

  const heroTop = hero.getBoundingClientRect().top;
  const laptopTop = laptop.getBoundingClientRect().top;
  const introBox = heroIntro.getBoundingClientRect();
  const targetCenter = (heroTop + laptopTop) / 2;
  const currentCenter = introBox.top + introBox.height / 2;

  heroIntro.style.top = `${targetCenter - currentCenter}px`;
}

positionMobileIntro();

/* Clone the real [SELF] section into the screen layer. */
const aboutInner = work.querySelector(".about .section-inner");
if (aboutInner) {
  const portalContent = aboutInner.cloneNode(true);
  portalContent.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  portalContent.querySelectorAll("img").forEach((img) => {
    img.alt = "";
    img.removeAttribute("loading");
  });
  portalContent.querySelectorAll(".carousel").forEach((button) => {
    button.tabIndex = -1;
    button.removeAttribute("data-gallery");
    button.removeAttribute("aria-label");
    button.setAttribute("aria-hidden", "true");
  });
  portalStage.replaceChildren(portalContent);
}

/* ------------------------------------------------------------------
   Scroll lock
   
   ------------------------------------------------------------------ */
const scrollKeys = new Set([
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function guardScroll(event) {
  if (!locked) return;

  if (event.type === "keydown") {
    if (!scrollKeys.has(event.key)) return;
    if (event.target instanceof Element && event.target.closest(".sound-toggle")) return;
    event.preventDefault();
    return;
  }

  event.preventDefault();
}

function lockScroll() {
  locked = true;
  root.classList.add("is-locked");
  main.inert = true;
  window.scrollTo(0, 0);
  window.addEventListener("wheel", guardScroll, { passive: false });
  window.addEventListener("touchmove", guardScroll, { passive: false });
  window.addEventListener("keydown", guardScroll);
}

function releaseScrollLock() {
  if (!locked) return;
  locked = false;
  window.scrollTo(0, 0);
  root.classList.remove("is-locked");
  main.inert = false;
  window.removeEventListener("wheel", guardScroll);
  window.removeEventListener("touchmove", guardScroll);
  window.removeEventListener("keydown", guardScroll);
}

lockScroll();

/* ------------------------------------------------------------------
   Theme
   ------------------------------------------------------------------ */
let themeTransitioning = false;
let themePointerOrigin = null;

function updateThemeToggle() {
  const dark = root.dataset.theme === "dark";
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
}

function applyTheme(theme) {
  if (theme === "dark") {
    root.dataset.theme = "dark";
  } else {
    delete root.dataset.theme;
  }
  try {
    localStorage.setItem("carl-theme", theme);
  } catch {}
  updateThemeToggle();
}

function toggleTheme(event) {
  if (themeTransitioning) return;

  playThemeToggleSound();

  const next = root.dataset.theme === "dark" ? "light" : "dark";
  const canAnimate =
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canAnimate) {
    applyTheme(next);
    return;
  }

  const bounds = themeToggle.getBoundingClientRect();
  let originX = bounds.left + bounds.width / 2;
  let originY = bounds.top + bounds.height / 2;

  if (event && event.detail > 0) {
    originX = event.clientX;
    originY = event.clientY;
    if (originX === 0 && originY === 0 && themePointerOrigin) {
      originX = themePointerOrigin.x;
      originY = themePointerOrigin.y;
    }
  } else if (event && themePointerOrigin) {
    originX = themePointerOrigin.x;
    originY = themePointerOrigin.y;
  }
  themePointerOrigin = null;

  const radius = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY),
  );

  themeTransitioning = true;
  const transition = document.startViewTransition(() => applyTheme(next));

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius}px at ${originX}px ${originY}px)`,
          ],
        },
        {
          duration: THEME_REVEAL,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});

  transition.finished.finally(() => {
    themeTransitioning = false;
  });
}

updateThemeToggle();
themeToggle?.addEventListener("pointerdown", (event) => {
  themePointerOrigin = { x: event.clientX, y: event.clientY };
});
themeToggle?.addEventListener("click", toggleTheme);

/* ------------------------------------------------------------------
   Keystroke audio
   ------------------------------------------------------------------ */
let soundOn = true;
try {
  soundOn = localStorage.getItem("carl-sound") !== "off";
} catch {}

let audioCtx = null;
let masterGain = null;
let typingData = null;
let typingBuffer = null;
let toggleData = null;
let toggleBuffer = null;
let wavFailed = false;
let firstGestureHandled = false;

function updateSoundControl() {
  if (!soundToggle) return;
  const label = soundToggle.querySelector(".magnetic__inner");

  if (wavFailed) {
    soundToggle.disabled = true;
    soundToggle.setAttribute("aria-label", "Sound unavailable");
    if (label) label.textContent = "SOUND UNAVAILABLE";
    return;
  }

  soundToggle.disabled = false;
  soundToggle.setAttribute("aria-pressed", String(soundOn));
  soundToggle.setAttribute("aria-label", soundOn ? "Mute sound" : "Unmute sound");
  if (label) label.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
}

async function decodeTypingBuffer() {
  if (!typingData || typingBuffer || !audioCtx) return;
  try {
    typingBuffer = await audioCtx.decodeAudioData(typingData.slice(0));
  } catch {
    typingBuffer = null;
    wavFailed = true;
  }
  updateSoundControl();
}

async function decodeToggleBuffer() {
  if (!toggleData || toggleBuffer || !audioCtx) return;
  try {
    toggleBuffer = await audioCtx.decodeAudioData(toggleData.slice(0));
  } catch {
    toggleBuffer = null;
  }
}

async function unlockAudio() {
  if (!soundOn) return;

  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        wavFailed = true;
        updateSoundControl();
        return;
      }
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = INTRO.keyVolume;
      masterGain.connect(audioCtx.destination);
    }

    await audioCtx.resume();
    await decodeTypingBuffer();
    await decodeToggleBuffer();
    updateSoundControl();
  } catch {
    updateSoundControl();
  }
}

function setSoundPreference(on) {
  soundOn = on;
  try {
    localStorage.setItem("carl-sound", on ? "on" : "off");
  } catch {}
  updateSoundControl();
  return on ? unlockAudio() : undefined;
}

function playUiSound(buffer, rate, volume) {
  if (!buffer || !audioCtx || audioCtx.state !== "running") return;

  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start();
}

function playTypingClickSound() {
  playUiSound(typingBuffer, SOUND.clickRate, SOUND.clickVolume);
}

function playThemeToggleSound() {
  if (!soundOn) return;

  const play = () => {
    if (toggleBuffer) playUiSound(toggleBuffer, 1, SOUND.toggleVolume);
  };

  if (audioCtx && audioCtx.state === "running" && toggleBuffer) play();
  else unlockAudio().then(play);
}

soundToggle?.addEventListener("click", () => {
  if (soundOn) {
    const play = () => playTypingClickSound();
    if (audioCtx && audioCtx.state === "running" && typingBuffer) play();
    else unlockAudio().then(play);
    setSoundPreference(false);
  } else {
    setSoundPreference(true).then(playTypingClickSound);
  }
});

function onFirstGesture() {
  if (firstGestureHandled) return;
  firstGestureHandled = true;
  window.removeEventListener("pointerdown", onFirstGesture, true);
  window.removeEventListener("keydown", onFirstGesture, true);
  if (soundOn) unlockAudio();
}

window.addEventListener("pointerdown", onFirstGesture, { capture: true });
window.addEventListener("keydown", onFirstGesture, { capture: true });
updateSoundControl();

/* ------------------------------------------------------------------
   Image carousels
   ------------------------------------------------------------------ */
const CAROUSEL_INTERVAL = 4500;

function playCarouselClickSound() {
  if (!soundOn) return;

  const play = () => playTypingClickSound();
  if (audioCtx && audioCtx.state === "running" && typingBuffer) play();
  else unlockAudio().then(play);
}

document.querySelectorAll(".carousel[data-gallery]").forEach((button) => {
  const slides = galleryImages[button.dataset.gallery] || [];
  const layers = [...button.querySelectorAll(".carousel__image")];
  if (!slides.length || layers.length < 2) return;

  if (slides.length === 1) {
    layers[0].src = slides[0].url;
    button.removeAttribute("aria-label");
    button.disabled = true;
    return;
  }

  const baseAlt = layers[0].alt || "Portfolio photo";
  let timer = null;
  let visible = false;
  let active = 0;
  let front = 1;

  const isSelf = button.dataset.gallery === "self1";
  const cloneButton = isSelf ? document.querySelector(".hero-portal .carousel") : null;
  const cloneLayers = isSelf
    ? [...document.querySelectorAll(".hero-portal .carousel__image")]
    : [];

  const apply = (index) => {
    front = 1 - front;
    const incoming = layers[front];
    const outgoing = layers[1 - front];

    incoming.src = slides[index].url;
    incoming.alt = baseAlt;
    incoming.removeAttribute("aria-hidden");
    outgoing.setAttribute("aria-hidden", "true");
    incoming.classList.add("is-active");
    outgoing.classList.remove("is-active");

    cloneLayers.forEach((layer, layerIndex) => {
      const source = layers[layerIndex];
      if (!source) return;
      if (source.src && layer.src !== source.src) layer.src = source.src;
      const isActive = source.classList.contains("is-active");
      layer.classList.toggle("is-active", isActive);
      if (isActive) layer.removeAttribute("aria-hidden");
      else layer.setAttribute("aria-hidden", "true");
    });
  };

  const canAuto = () => visible && !document.hidden && !reducedMotion;

  const schedule = () => {
    clearTimeout(timer);
    if (!canAuto()) return;
    timer = setTimeout(() => {
      active = (active + 1) % slides.length;
      apply(active);
      schedule();
    }, CAROUSEL_INTERVAL);
  };

  const next = (manual) => {
    clearTimeout(timer);
    active = (active + 1) % slides.length;
    apply(active);
    if (manual) playCarouselClickSound();
    schedule();
  };

  apply(0);

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.1 },
  );
  observer.observe(button);

  button.addEventListener("click", () => next(true));
  // The portal clone covers the real Self carousel while the hero is pinned.
  cloneButton?.addEventListener("click", () => next(true));
  document.addEventListener("visibilitychange", schedule);
});

function playKeystroke() {
  if (!soundOn || !typingBuffer || !audioCtx || !masterGain) return;
  if (audioCtx.state !== "running") return;

  const source = audioCtx.createBufferSource();
  source.buffer = typingBuffer;
  source.connect(masterGain);
  source.start();
}

/* ------------------------------------------------------------------
   Asset readiness + loader progress
   ------------------------------------------------------------------ */
const tasks = [];
let settled = 0;
let assetsComplete = false;

function trackTask(promise) {
  const task = Promise.race([Promise.resolve(promise), wait(8000)])
    .catch(() => {})
    .then(() => {
      settled += 1;
    });

  tasks.push(task);
  return task;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }

    const image = new Image();
    const done = () => resolve();
    image.onload = done;
    image.onerror = done;
    image.src = url;
    if (image.complete) done();
  });
}

const galleryUrls = Object.values(galleryImages)
  .flat()
  .map((slide) => slide.url);
const imageUrls = [
  ...new Set(
    [...document.images]
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .concat(galleryUrls),
  ),
];
imageUrls.forEach((url) => trackTask(preloadImage(url)));

const lcdBackground = getComputedStyle(lcdPlane).backgroundImage;
const lcdUrl = (lcdBackground.match(/url\(["']?(.*?)["']?\)/) || [])[1];
if (lcdUrl) trackTask(preloadImage(lcdUrl));

["400", "500", "700"].forEach((weight) => {
  trackTask(document.fonts.load(`${weight} 16px "Helvetica Neue Web"`));
});
trackTask(document.fonts.ready);

const wavTask = fetch(typingWavUrl)
  .then((response) => {
    if (!response.ok) throw new Error("typing.wav failed");
    return response.arrayBuffer();
  })
  .then((data) => {
    typingData = data;
    if (soundOn && audioCtx) decodeTypingBuffer();
  })
  .catch(() => {
    wavFailed = true;
    updateSoundControl();
  });
trackTask(wavTask);

const toggleWavTask = fetch(darkModeToggleWavUrl)
  .then((response) => {
    if (!response.ok) throw new Error("darkmodetoggle.wav failed");
    return response.arrayBuffer();
  })
  .then((data) => {
    toggleData = data;
    if (soundOn && audioCtx) decodeToggleBuffer();
  })
  .catch(() => {});
trackTask(toggleWavTask);

const loaderProgress = {
  value: 0,
  started: false,
  done: false,
  startTime: 0,
};

function setLoaderDisplay(value) {
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = Math.round(clamped);
  if (loaderPercentInner) loaderPercentInner.textContent = `${rounded}%`;
  if (loaderPercent) loaderPercent.setAttribute("aria-valuenow", String(rounded));
  if (loaderBar) loaderBar.style.transform = `scaleX(${clamped / 100})`;
}

function stepLoaderProgress(now) {
  if (loaderProgress.done) return;

  if (!loaderProgress.started) {
    loaderProgress.started = true;
    loaderProgress.startTime = now;
  }

  const elapsed = now - loaderProgress.startTime;
  const timeTarget = 1 + 99 * Math.min(elapsed / INTRO.minLoad, 1);
  const target = Math.min(timeTarget, assetsComplete ? 100 : 95);
  const delta = target - loaderProgress.value;

  loaderProgress.value += delta * 0.11;
  if (loaderProgress.value < 1) loaderProgress.value = 1;

  if (assetsComplete && loaderProgress.value >= 99.5) {
    loaderProgress.value = 100;
    loaderProgress.done = true;
    setLoaderDisplay(100);
    setTimeout(finishLoading, 350);
    return;
  }

  setLoaderDisplay(loaderProgress.value);
  requestAnimationFrame(stepLoaderProgress);
}

Promise.all(tasks).then(() => {
  assetsComplete = true;
});

requestAnimationFrame(() => {
  requestAnimationFrame((now) => stepLoaderProgress(now));
});

/* ------------------------------------------------------------------
   Hero typing
   ------------------------------------------------------------------ */
const titleSegments = [
  { text: "HI, I'M ", red: false },
  { text: "CARL.", red: true },
];
const taglineSegments = [
  { text: "I TURN PLANS INTO ", red: false },
  { text: "REALITY.", red: true },
];

function buildSegments(container, segments) {
  const entries = [];

  segments.forEach((segment) => {
    const textNode = document.createTextNode("");

    if (segment.red) {
      const span = document.createElement("span");
      span.className = "is-red";
      span.appendChild(textNode);
      container.appendChild(span);
    } else {
      container.appendChild(textNode);
    }

    entries.push({ node: textNode, text: segment.text });
  });

  return entries;
}

function buildSteps(entries) {
  const steps = [];
  entries.forEach((entry) => {
    for (const char of entry.text) steps.push({ node: entry.node, char });
  });
  return steps;
}

async function typeSteps(steps) {
  for (const step of steps) {
    step.node.nodeValue += step.char;
    if (step.char.trim()) playKeystroke();
    await wait(INTRO.typeSpeed);
  }
}

async function finishCaret() {
  if (!caret) return;

  await new Promise((resolve) => {
    gsap
      .timeline({ onComplete: resolve })
      .to(caret, {
        opacity: 0,
        duration: 0.12,
        repeat: 3,
        yoyo: true,
        ease: "none",
      })
      .to(caret, { opacity: 0, duration: 0.2, ease: "none" });
  });

  caret.remove();
  caret = null;
}

function completeHeroText() {
  hero.classList.add("is-complete");
  hero.classList.add("is-intro-done");
  releaseScrollLock();
  ScrollTrigger.refresh();
  positionMobileIntro();
}

async function startIntro() {
  if (reducedMotion) {
    completeHeroText();
    return;
  }

  const titleEntries = buildSegments(titleTyped, titleSegments);
  const taglineEntries = buildSegments(taglineTyped, taglineSegments);
  const titleSteps = buildSteps(titleEntries);
  const taglineSteps = buildSteps(taglineEntries);

  caret = document.createElement("span");
  caret.className = "hero__caret";
  caret.setAttribute("aria-hidden", "true");
  titleTyped.appendChild(caret);

  await wait(180);
  await typeSteps(titleSteps);
  await wait(INTRO.linePause);

  titleTyped.removeChild(caret);
  taglineTyped.appendChild(caret);

  await wait(100);
  await typeSteps(taglineSteps);
  await finishCaret();

  hero.classList.add("is-intro-done");
  releaseScrollLock();
  ScrollTrigger.refresh();
  positionMobileIntro();
}

let introStarted = false;

async function finishLoading() {
  if (introStarted) return;
  introStarted = true;

  setLoaderDisplay(100);
  root.classList.remove("is-loading");
  root.classList.add("is-ready");
  loader?.classList.add("is-hidden");

  await wait(650);
  loader?.remove();
  window.scrollTo(0, 0);

  ScrollTrigger.refresh();

  if (reducedMotion) {
    completeHeroText();
    return;
  }

  await wait(150);
  startIntro();
}

/* ------------------------------------------------------------------
   Screen layer + scroll zoom
   ------------------------------------------------------------------ */
function zoomTarget() {
  const heroBox = hero.getBoundingClientRect();
  const laptopBox = laptop.getBoundingClientRect();
  const viewportW = document.documentElement.clientWidth;
  const viewportH = window.innerHeight;

  const centerX = laptopBox.left - heroBox.left + laptopBox.width * ZOOM.center.x;
  const centerY = laptopBox.top - heroBox.top + laptopBox.height * ZOOM.center.y;

  const scale =
    Math.max(
      viewportW / (laptopBox.width * ZOOM.display.width),
      viewportH / (laptopBox.height * ZOOM.display.height),
    ) * ZOOM.overscan;

  return { x: viewportW / 2 - centerX, y: viewportH / 2 - centerY, scale };
}

const mm = gsap.matchMedia();

function setupHeroZoom({ distance, fadeTargets, hideAbout = false }) {
  gsap.set(laptopImg, {
    transformOrigin: `${ZOOM.center.x * 100}% ${ZOOM.center.y * 100}%`,
  });

  // Mobile toolbars shrink 100svh below the visual viewport, so the pinned hero
  // leaves a gap that reveals the real About section behind the screen zoom.
  const aboutPanel = hideAbout ? work.querySelector(".about") : null;
  const setAboutHidden = (hidden) => {
    if (aboutPanel) aboutPanel.style.visibility = hidden ? "hidden" : "";
  };

  const setPinned = (active) => {
    setAboutHidden(active);
    // While pinned, let the zoomed laptop paint past the hero instead of being cut
    // above the visual viewport bottom. Reset it afterwards so it cannot add scroll width.
    hero.style.overflow = active ? "visible" : "";
  };

  let portalBase = null;

  const measurePortal = () => {
    const heroBox = hero.getBoundingClientRect();
    const laptopBox = laptop.getBoundingClientRect();
    const target = zoomTarget();
    const startX = laptopBox.left - heroBox.left + laptopBox.width * ZOOM.center.x;
    const startY = laptopBox.top - heroBox.top + laptopBox.height * ZOOM.center.y;

    portalBase = {
      startX,
      startY,
      endX: startX + target.x,
      endY: startY + target.y,
      screenW: laptopBox.width * ZOOM.display.width,
      screenH: laptopBox.height * ZOOM.display.height,
      finalScale: target.scale,
      viewportW: document.documentElement.clientWidth,
      viewportH: window.innerHeight,
    };

    lcdPlane.style.width = `${portalBase.screenW}px`;
    lcdPlane.style.height = `${portalBase.screenH}px`;
  };

  const updatePortal = (progress) => {
    if (!portalBase) return;

    const b = portalBase;
    const zoom = 1 + (b.finalScale - 1) * progress;
    const cx = b.startX + (b.endX - b.startX) * progress;
    const cy = b.startY + (b.endY - b.startY) * progress;
    const halfW = (b.screenW * zoom) / 2;
    const halfH = (b.screenH * zoom) / 2;

    const top = Math.max(0, cy - halfH);
    const right = Math.max(0, b.viewportW - (cx + halfW));
    const bottom = Math.max(0, b.viewportH - (cy + halfH));
    const left = Math.max(0, cx - halfW);
    const clip = `inset(${top}px ${right}px ${bottom}px ${left}px)`;

    portal.style.clipPath = clip;
    lcdTexture.style.clipPath = clip;
    lcdVignette.style.clipPath = clip;

    portalStage.style.transformOrigin = `${cx}px ${cy}px`;
    portalStage.style.transform = `scale(${zoom / b.finalScale})`;

    lcdPlane.style.transform = `translate(${cx - halfW}px, ${cy - halfH}px) scale(${zoom})`;
  };

  // Once the zoom is over, cover the whole viewport. The screen-sized plane and
  // clip are only for the transition and can end up smaller after mobile toolbars resize.
  const setLcdFull = () => {
    lcdTexture.style.clipPath = "none";
    lcdVignette.style.clipPath = "none";
    lcdPlane.style.width = "100%";
    lcdPlane.style.height = "100%";
    lcdPlane.style.transform = "none";
    setLcdFade(1);
  };

  measurePortal();
  setLcdFade(0);

  const lcdState = { fade: 0 };

  const setHeroHidden = (hidden) => {
    hero.style.visibility = hidden ? "hidden" : "";
    // The pin spacer overlaps the work section; keep it from swallowing clicks once the hero is gone.
    const spacer = hero.parentElement;
    if (spacer?.classList.contains("pin-spacer")) {
      spacer.style.pointerEvents = hidden ? "none" : "";
    }
  };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate() {
      updatePortal(this.progress());
    },
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: () => `+=${distance()}`,
      pin: true,
      scrub: ZOOM.smoothing,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measurePortal();
        setPinned(self.isActive);
        if (heroPin) setHeroHidden(window.scrollY > heroPin.end);
        if (self.isActive) updatePortal(self.progress);
        else if (window.scrollY >= self.end) setLcdFull();
      },
      onToggle: (self) => {
        setPinned(self.isActive);
      },
      onLeave: () => {
        setHeroHidden(true);
        setLcdFull();
      },
      onEnterBack: (self) => {
        setHeroHidden(false);
        measurePortal();
        updatePortal(self.progress);
      },
    },
  });

  heroPin = tl.scrollTrigger;
  setAboutHidden(heroPin.isActive);

  tl.to(fadeTargets, { autoAlpha: 0, y: -24, duration: 0.18 }, 0)
    .to(scrollHint, { autoAlpha: 0, duration: 0.18, immediateRender: false }, 0)
    .to(
      [laptopImg, laptopScreen],
      {
        x: () => zoomTarget().x,
        y: () => zoomTarget().y,
        scale: () => zoomTarget().scale,
        duration: 1,
      },
      0,
    )
    .fromTo(portal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 0.02)
    .to(laptopScreen, { opacity: 0, duration: 0.8 }, 0.02)
    .to(
      lcdState,
      {
        fade: 1,
        duration: 0.8,
        onUpdate: () => setLcdFade(lcdState.fade),
      },
      0.02,
    );

  return () => {
    heroPin = null;
    setHeroHidden(false);
    setPinned(false);
    setLcdFade(0);
    lcdTexture.style.clipPath = "";
    lcdVignette.style.clipPath = "";
    lcdPlane.style.width = "";
    lcdPlane.style.height = "";
    lcdPlane.style.transform = "";
    gsap.set(fadeTargets, { clearProps: "all" });
    gsap.set([laptopImg, laptopScreen], { clearProps: "all" });
    gsap.set(portal, { clearProps: "opacity,visibility" });
  };
}

mm.add(DESKTOP_MOTION, () =>
  setupHeroZoom({
    distance: () => ZOOM.scroll * window.innerHeight,
    fadeTargets: head,
  }),
);

mm.add(
  "(max-width: 899px) and (prefers-reduced-motion: no-preference)",
  () =>
    setupHeroZoom({
      distance: () => ZOOM.mobileScroll * window.innerHeight,
      fadeTargets: [heroIntro, socials],
      hideAbout: true,
    }),
);

/* ------------------------------------------------------------------
   Horizontal project track
   ------------------------------------------------------------------ */
mm.add(DESKTOP_MOTION, () => {
  const distance = () => track.scrollWidth - track.clientWidth;

  gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: work,
      start: "top top",
      end: () => `+=${distance()}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  return () => {
    gsap.set(track, { clearProps: "transform" });
  };
});

/* ------------------------------------------------------------------
   Mobile / reduced-motion LCD trigger
   ------------------------------------------------------------------ */
mm.add("(max-width: 899px), (prefers-reduced-motion: reduce)", () => {
  const self = document.querySelector(".work .about");
  const contact = document.querySelector(".contact");
  const state = { fade: 0 };

  if (reducedMotion) {
    lcdTexture.style.clipPath = "inset(0px)";
    lcdVignette.style.clipPath = "inset(0px)";
  }

  const trigger = ScrollTrigger.create({
    trigger: self,
    start: "top top",
    endTrigger: contact,
    end: "bottom bottom",
    onToggle: (self) => {
      gsap.to(state, {
        fade: self.isActive ? 1 : 0,
        duration: 0.45,
        ease: "none",
        overwrite: true,
        onUpdate: () => setLcdFade(state.fade),
      });
    },
  });

  state.fade = trigger.isActive ? 1 : 0;
  setLcdFade(state.fade);

  return () => {
    trigger.kill();
    gsap.killTweensOf(state);
    setLcdFade(0);
    lcdTexture.style.clipPath = "";
    lcdVignette.style.clipPath = "";
  };
});

/* ------------------------------------------------------------------
   Section-group magnetic pull
   ------------------------------------------------------------------ */
const magneticGroups = [];

function makeGroup(anchor) {
  if (!anchor) return null;
  const group = { anchor, items: [] };
  magneticGroups.push(group);
  return group;
}

function addGroupItem(group, outer, inner, kind) {
  if (!group || !outer || !inner) return;
  group.items.push({ outer, inner, kind, x: 0, y: 0 });
}

function wrapTextTarget(element) {
  if (!element || element.querySelector(":scope > .magnet-inner--block")) return null;
  const inner = document.createElement("span");
  inner.className = "magnet-inner magnet-inner--block";
  while (element.firstChild) inner.appendChild(element.firstChild);
  element.appendChild(inner);
  return inner;
}

function addSectionGroup(section) {
  const group = makeGroup(section);
  if (!group) return;

  section
    .querySelectorAll(
      ".eyebrow, .about__title, .about__content p, .feature__title, .feature__meta, .feature__body, .feature__stack, .skills__intro, .contact__title, .contact__pitch",
    )
    .forEach((element) => {
      addGroupItem(group, element, wrapTextTarget(element), "text");
    });

  section.querySelectorAll(".magnetic-thumb").forEach((element) => {
    addGroupItem(group, element, element.querySelector(".magnetic__inner"), "image");
  });

  section.querySelectorAll(".skills__list").forEach((element) => {
    addGroupItem(group, element, element, "card");
  });

  section.querySelectorAll(".contact__button").forEach((element) => {
    addGroupItem(group, element, element.querySelector(".contact__button-inner"), "button");
  });

  section.querySelectorAll(".contact__direct").forEach((element) => {
    addGroupItem(group, element, element, "card");
  });
}

document
  .querySelectorAll(".work .about, .work .feature, main > .feature, .skills, .contact")
  .forEach(addSectionGroup);

// The LCD scanline layer follows the same desktop pointer.
const lcdGroup = makeGroup(lcdTexture);
addGroupItem(lcdGroup, lcdTexture, lcdTexture, "lcd");

mm.add(
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  () => {
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;

    function onPointerMove(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerActive = true;
    }

    function deactivate() {
      pointerActive = false;
    }

    function onVisibilityChange() {
      if (document.hidden) deactivate();
    }

    function isVisible(element) {
      if (!element.isConnected) return false;
      if (element.checkVisibility) {
        if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
          return false;
        }
      }
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.top < window.innerHeight &&
        bounds.right > 0 &&
        bounds.left < window.innerWidth
      );
    }

    function tick(time, deltaTime) {
      const dt = Math.min(deltaTime, 64) / 1000;
      const ease = 1 - Math.exp(-dt * MAGNET.ease);
      const loaderActive = !!loader && loader.isConnected;
      const viewportRadius = Math.hypot(window.innerWidth, window.innerHeight);

      magneticGroups.forEach((group) => {
        let groupX = 0;
        let groupY = 0;
        let directionX = 0;
        let directionY = 0;
        let extraItem = null;
        let extraDistance = Infinity;
        let extraX = 0;
        let extraY = 0;

        if (!loaderActive && pointerActive && isVisible(group.anchor)) {
          const bounds = group.anchor.getBoundingClientRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const dx = pointerX - centerX;
          const dy = pointerY - centerY;
          const distance = Math.hypot(dx, dy);

          if (distance > 0.5) {
            directionX = dx / distance;
            directionY = dy / distance;
            const nearness = Math.max(0, 1 - distance / viewportRadius);
            const influence =
              MAGNET.baseInfluence + (1 - MAGNET.baseInfluence) * nearness;
            const pull = MAGNET.group * influence;
            groupX = directionX * pull;
            groupY = directionY * pull;
          }

          group.items.forEach((item) => {
            if (item.kind !== "image" && item.kind !== "button") return;
            if (!isVisible(item.outer)) return;

            const itemBounds = item.outer.getBoundingClientRect();
            const itemX = itemBounds.left + itemBounds.width / 2;
            const itemY = itemBounds.top + itemBounds.height / 2;
            const itemDistance = Math.hypot(pointerX - itemX, pointerY - itemY);

            if (itemDistance < extraDistance) {
              extraDistance = itemDistance;
              extraItem = item;
            }
          });

          if (extraItem && extraDistance > 0.5) {
            const nearness = Math.max(0, 1 - extraDistance / viewportRadius);
            const influence =
              MAGNET.baseInfluence + (1 - MAGNET.baseInfluence) * nearness;
            const pull = MAGNET.extra * influence;
            extraX = directionX * pull;
            extraY = directionY * pull;
          }
        }

        group.items.forEach((item) => {
          let targetX = groupX;
          let targetY = groupY;

          if (item === extraItem) {
            targetX += extraX;
            targetY += extraY;
          }

          item.x += (targetX - item.x) * ease;
          item.y += (targetY - item.y) * ease;

          if (Math.abs(item.x) < 0.01 && Math.abs(item.y) < 0.01) {
            item.x = 0;
            item.y = 0;
          }

          item.inner.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        });
      });
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", deactivate);
    window.addEventListener("blur", deactivate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", deactivate);
      window.removeEventListener("blur", deactivate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      magneticGroups.forEach((group) => {
        group.items.forEach((item) => {
          item.inner.style.transform = "";
        });
      });
    };
  },
);

/* ------------------------------------------------------------------
   Copy placeholder contact values
   ------------------------------------------------------------------ */
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {}

  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {}
  area.remove();
  return copied;
}

document.querySelectorAll(".contact__row[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    if (!value || !(await copyText(value))) return;

    const tag = button.querySelector(".contact__tag");
    if (!tag) return;

    const original = tag.textContent;
    tag.textContent = "COPIED";
    clearTimeout(button.__copyReset);
    button.__copyReset = setTimeout(() => {
      tag.textContent = original;
    }, 1400);
  });
});

/* ------------------------------------------------------------------
   Refresh after layout/assets settle
   ------------------------------------------------------------------ */
window.addEventListener(
  "load",
  () => {
    ScrollTrigger.refresh();
    positionMobileIntro();
    if (heroPin && window.scrollY > heroPin.end + 1) {
      hero.style.visibility = "hidden";
    }
  },
  { once: true },
);

let resizeFrame = 0;
let resizeWidth = window.innerWidth;

window.addEventListener("resize", () => {
  const widthChanged = window.innerWidth !== resizeWidth;
  resizeWidth = window.innerWidth;
  // Mobile toolbars only change the height while scrolling; re-measuring then makes the page jump.
  if (!widthChanged && window.matchMedia("(max-width: 899px)").matches) return;

  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    positionMobileIntro();
    if (heroPin) {
      hero.style.visibility = window.scrollY > heroPin.end ? "hidden" : "";
    }
  });
});

document.fonts?.ready.then(positionMobileIntro);
