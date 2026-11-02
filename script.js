/* ───────────────────────────────────────────────────────────
   CONFIGURACIÓN DEL LOCAL
   Rellena lo que tengas. Lo que quede vacío no se muestra.
   - whatsapp: número con prefijo, solo dígitos (ej. "34600000000").
     Si lo pones, cada reserva abre WhatsApp con el mensaje ya escrito.
   - formEndpoint: URL de Formspree, Getform, etc. Si lo pones,
     las reservas se envían ahí (te llegan por email).
   ─────────────────────────────────────────────────────────── */
const CONFIG = {
  whatsapp: "",
  phone: "",
  email: "",
  formEndpoint: "",
  maxPeople: 10,
  slotMinutes: 30,
  lastSlotBeforeCloseMin: 60,
  daysAhead: 14,
};

/* Horario: [apertura, cierre] en minutos desde medianoche; cierre > 1440 = madrugada siguiente */
const HOURS = {
  0: [870, 1470], // domingo 14:30–00:30
  1: [900, 1470], 2: [900, 1470], 3: [900, 1470], 4: [900, 1470], // lun–jue 15:00–00:30
  5: [900, 1530], // viernes 15:00–01:30
  6: [870, 1530], // sábado 14:30–01:30
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DOW_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pad = (n) => String(n).padStart(2, "0");
const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ─── Estado ─── */
const state = { date: null, time: null, people: 2 };

function upcomingDays() {
  const out = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < CONFIG.daysAhead; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (slotsFor(d).length) out.push(d);
  }
  return out;
}

function slotsFor(date) {
  const [open, close] = HOURS[date.getDay()];
  const last = close - CONFIG.lastSlotBeforeCloseMin;
  const now = new Date();
  const isToday = isoDate(date) === isoDate(now);
  const minNow = now.getHours() * 60 + now.getMinutes() + 30;
  const out = [];
  for (let m = open; m <= last; m += CONFIG.slotMinutes) {
    if (isToday && m < minNow) continue;
    out.push(m);
  }
  return out;
}

function dayLabel(d, i) {
  if (i === 0 && isoDate(d) === isoDate(new Date())) return `Hoy, ${d.getDate()} ${MON[d.getMonth()]}`;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (isoDate(d) === isoDate(tomorrow)) return `Mañana, ${d.getDate()} ${MON[d.getMonth()]}`;
  return `${DOW[d.getDay()][0].toUpperCase() + DOW[d.getDay()].slice(1)} ${d.getDate()} ${MON[d.getMonth()]}`;
}

const days = upcomingDays();
const dateByIso = Object.fromEntries(days.map((d) => [isoDate(d), d]));

/* ─── Reserva rápida (hero) ─── */
const quick = $("[data-quick]");
const qDate = $("[data-quick-date]"), qTime = $("[data-quick-time]"), qPeople = $("[data-quick-people]");

function fillQuickTimes() {
  const slots = slotsFor(dateByIso[qDate.value]);
  qTime.innerHTML = slots.map((m) => `<option value="${m}">${fmtMin(m)}</option>`).join("");
  const pref = slots.find((m) => m >= 18 * 60) ?? slots[0];
  if (state.time != null && slots.includes(state.time)) qTime.value = state.time;
  else if (pref != null) qTime.value = pref;
}
qDate.innerHTML = days.map((d, i) => `<option value="${isoDate(d)}">${dayLabel(d, i)}</option>`).join("");
qPeople.innerHTML = Array.from({ length: CONFIG.maxPeople }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
qPeople.value = state.people;
fillQuickTimes();
qDate.addEventListener("change", fillQuickTimes);

quick.addEventListener("submit", (e) => {
  e.preventDefault();
  selectDate(qDate.value, false);
  selectTime(Number(qTime.value));
  setPeople(Number(qPeople.value));
  go("reservas");
  setTimeout(() => $('[name="name"]').focus({ preventScroll: true }), reduceMotion ? 50 : 700);
});

/* ─── Formulario completo ─── */
const form = $("[data-reserve]");
const daysEl = $("[data-days]");
const slotsEl = $("[data-slots]");

daysEl.innerHTML = days.map((d, i) => {
  const today = i === 0 && isoDate(d) === isoDate(new Date());
  return `<button type="button" class="day" role="radio" aria-checked="false" data-date="${isoDate(d)}"
    aria-label="${today ? "Hoy, " : ""}${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}">
    <small>${today ? "hoy" : DOW[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
}).join("");

function selectDate(iso, animate = true) {
  state.date = iso;
  $$(".day", daysEl).forEach((b) => {
    const on = b.dataset.date === iso;
    b.setAttribute("aria-checked", on);
    b.tabIndex = on ? 0 : -1;
    if (on && b.scrollIntoView) {
      const r = b.getBoundingClientRect(), p = daysEl.getBoundingClientRect();
      if (r.left < p.left || r.right > p.right) daysEl.scrollTo({ left: b.offsetLeft - 8, behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
  renderSlots(animate);
}

function renderSlots(animate) {
  const slots = slotsFor(dateByIso[state.date]);
  if (!slots.includes(state.time)) state.time = null;
  slotsEl.innerHTML = slots.length
    ? slots.map((m, i) => `<button type="button" class="slot" role="radio" aria-checked="${m === state.time}" tabindex="${m === state.time ? 0 : -1}" data-time="${m}" style="--i:${i}">${fmtMin(m)}</button>`).join("")
    : `<p class="slots-empty">No quedan horas para hoy. Prueba otro día.</p>`;
  if (state.time == null && slots.length) $(".slot", slotsEl).tabIndex = 0;
  if (animate && !reduceMotion) {
    slotsEl.classList.remove("is-swapping"); void slotsEl.offsetWidth; slotsEl.classList.add("is-swapping");
  }
  updateSummary();
}

function selectTime(m) {
  state.time = m;
  $$(".slot", slotsEl).forEach((b) => {
    const on = Number(b.dataset.time) === m;
    b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1;
  });
  setError("when", "");
  updateSummary();
}

daysEl.addEventListener("click", (e) => { const b = e.target.closest(".day"); if (b) selectDate(b.dataset.date); });
slotsEl.addEventListener("click", (e) => { const b = e.target.closest(".slot"); if (b) selectTime(Number(b.dataset.time)); });

/* Teclado en grupos de radio: flechas */
function arrowNav(container, sel, onPick) {
  container.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    const items = $$(sel, container);
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + keys[e.key] + items.length) % items.length];
    next.focus(); onPick(next);
  });
}
arrowNav(daysEl, ".day", (b) => selectDate(b.dataset.date));
arrowNav(slotsEl, ".slot", (b) => selectTime(Number(b.dataset.time)));

/* Personas */
const pVal = $("[data-people-value]"), pMinus = $("[data-people-minus]"), pPlus = $("[data-people-plus]"), pUnit = $("[data-people-unit]");
function setPeople(n) {
  const prev = state.people;
  state.people = Math.max(1, Math.min(CONFIG.maxPeople, n));
  pVal.textContent = state.people;
  pUnit.textContent = state.people === 1 ? "persona" : "personas";
  pMinus.disabled = state.people <= 1;
  pPlus.disabled = state.people >= CONFIG.maxPeople;
  $("[data-people-hint]").classList.toggle("is-max", state.people >= CONFIG.maxPeople);
  if (prev !== state.people && !reduceMotion) { pVal.classList.remove("bump"); void pVal.offsetWidth; pVal.classList.add("bump"); }
  updateSummary();
}
pMinus.addEventListener("click", () => setPeople(state.people - 1));
pPlus.addEventListener("click", () => setPeople(state.people + 1));

/* Resumen */
const summary = $("[data-summary]");
function niceDate(iso) {
  const d = dateByIso[iso];
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}`;
}
function updateSummary() {
  if (!state.date) return;
  const t = state.time != null ? `a las <b>${fmtMin(state.time)}</b>` : "<span>elige una hora</span>";
  summary.innerHTML = `Mesa para <b>${state.people}</b>, el <b>${niceDate(state.date)}</b> ${t}`;
}

/* Validación */
function setError(key, msg) {
  const el = $(`[data-error="${key}"]`);
  if (el) el.textContent = msg;
  const input = form.elements[key];
  if (input && input.setAttribute) input.setAttribute("aria-invalid", msg ? "true" : "false");
}
function validate() {
  let first = null;
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.replace(/[^\d+]/g, "");
  if (state.time == null) { setError("when", "Elige una hora para tu reserva."); first ??= $(".slot", slotsEl) || daysEl; }
  if (name.length < 2) { setError("name", "Escribe tu nombre para la reserva."); first ??= form.elements.name; } else setError("name", "");
  if (phone.replace("+", "").length < 9) { setError("phone", "Necesitamos un teléfono de 9 cifras para confirmarte."); first ??= form.elements.phone; } else setError("phone", "");
  if (first) first.focus();
  return !first;
}
["name", "phone"].forEach((k) => form.elements[k].addEventListener("input", () => {
  if (form.elements[k].getAttribute("aria-invalid") === "true") setError(k, "");
}));

/* Envío */
const submitBtn = $("[data-submit]");
const ticket = $("[data-ticket]");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const data = {
    fecha: state.date,
    hora: fmtMin(state.time),
    personas: state.people,
    nombre: form.elements.name.value.trim(),
    telefono: form.elements.phone.value.trim(),
    comentarios: form.elements.notes.value.trim(),
  };
  submitBtn.setAttribute("aria-busy", "true");
  let mode = "demo";

  try {
    if (CONFIG.formEndpoint) {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: `Reserva Gulateria: ${data.nombre}, ${data.personas} pers.`, ...data }),
      });
      if (!res.ok) throw new Error("send failed");
      mode = "sent";
    }
    if (CONFIG.whatsapp) {
      const msg = `Hola Gulateria, quiero reservar mesa:\n• ${niceDate(state.date)} a las ${data.hora}\n• ${data.personas} personas\n• A nombre de ${data.nombre} (${data.telefono})${data.comentarios ? `\n• ${data.comentarios}` : ""}`;
      window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      mode = "whatsapp";
    }
  } catch {
    submitBtn.removeAttribute("aria-busy");
    setError("when", "No hemos podido enviar la reserva. Inténtalo otra vez o escríbenos por Instagram.");
    return;
  }

  await new Promise((r) => setTimeout(r, mode === "demo" ? 450 : 0));
  submitBtn.removeAttribute("aria-busy");
  if (form.elements.remember.checked) store.set({ name: data.nombre, phone: data.telefono });
  else store.clear();
  lastBooking = { ...data, minutes: state.time };
  showTicket(data, mode);
});

function showTicket(data, mode) {
  $('[data-t="date"]').textContent = niceDate(state.date);
  $('[data-t="time"]').textContent = data.hora;
  $('[data-t="people"]').textContent = data.personas;
  $('[data-t="name"]').textContent = data.nombre;
  const note = $("[data-ticket-note]");
  note.classList.toggle("is-demo", mode === "demo");
  note.textContent = {
    whatsapp: "Termina de enviar el mensaje en WhatsApp y te confirmamos enseguida.",
    sent: "Te escribiremos para confirmarla. Si algo cambia, avísanos por Instagram.",
    demo: "Vista previa: el formulario aún no está conectado, así que esta reserva no le ha llegado al local.",
  }[mode];
  $("[data-ticket-title]").textContent = mode === "demo" ? "Así quedaría tu reserva" : mode === "whatsapp" ? "¡Ya casi está!" : "¡Reserva enviada!";
  form.hidden = true;
  ticket.hidden = false;
  ticket.classList.remove("is-in"); void ticket.offsetWidth; ticket.classList.add("is-in");
  ticket.focus({ preventScroll: true });
  $("#reservas").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
$("[data-new]").addEventListener("click", () => {
  ticket.hidden = true; form.hidden = false; form.reset();
  state.time = null; renderSlots(false); prefillRemembered(); form.elements.name.focus();
});

/* ─── Horario: hoy y abierto ahora ─── */
function openStatus(now = new Date()) {
  const dow = now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  const yest = (dow + 6) % 7;
  const [o, c] = HOURS[dow];
  if (m >= o && m < c) return { open: true, text: `Abierto ahora · hasta las ${fmtMin(c)}` };
  if (m + 1440 < HOURS[yest][1]) return { open: true, text: `Abierto ahora · hasta las ${fmtMin(HOURS[yest][1] - 1440)}` };
  return { open: false, text: m < o ? `Abrimos hoy a las ${fmtMin(o)}` : `Abrimos mañana a las ${fmtMin(HOURS[(dow + 1) % 7][0])}` };
}
function paintStatus() {
  const st = openStatus();
  const dow = new Date().getDay();
  $$(".hours tr").forEach((r) => r.classList.toggle("today", r.dataset.days.split(",").map(Number).includes(dow)));
  const el = $("[data-open-now]");
  el.textContent = st.text; el.classList.toggle("is-open", st.open);
  const pill = $("[data-open-pill]");
  pill.textContent = st.text; pill.classList.toggle("is-open", st.open); pill.hidden = false;
  $("[data-dock-status]").textContent = st.text;
}
paintStatus();
setInterval(paintStatus, 60_000);

/* ─── Contacto según configuración ─── */
(function contact() {
  const items = {
    whatsapp: CONFIG.whatsapp && { href: `https://wa.me/${CONFIG.whatsapp}`, text: `+${CONFIG.whatsapp.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4")}` },
    phone: CONFIG.phone && { href: `tel:${CONFIG.phone.replace(/\s/g, "")}`, text: CONFIG.phone },
    email: CONFIG.email && { href: `mailto:${CONFIG.email}`, text: CONFIG.email },
  };
  for (const [k, v] of Object.entries(items)) {
    if (!v) continue;
    const li = $(`[data-contact="${k}"]`);
    $("a", li).href = v.href;
    $("[data-contact-text]", li).textContent = v.text;
    li.hidden = false;
  }
})();

/* ─── Nav con sombra al hacer scroll ─── */
const nav = $("[data-nav]");
const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => nav.toggleAttribute("data-scrolled", !e.isIntersecting)).observe(sentinel);

$("[data-year]").textContent = new Date().getFullYear();

/* Estado inicial */
selectDate(days[0] && isoDate(days[0]), false);
setPeople(2);

/* ─── Recordar datos (solo en este dispositivo) ─── */
const STORE_KEY = "gulateria:datos";
const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; } },
  set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch {} },
};
function prefillRemembered() {
  const saved = store.get();
  const note = $("[data-remembered]");
  if (!saved || !saved.name) { note.hidden = true; return; }
  form.elements.name.value = saved.name;
  form.elements.phone.value = saved.phone || "";
  note.firstChild.textContent = `Hola de nuevo, ${saved.name.split(" ")[0]}. Hemos rellenado tus datos de la última vez. `;
  note.hidden = false;
}
$("[data-forget]").addEventListener("click", () => {
  store.clear();
  form.elements.name.value = ""; form.elements.phone.value = "";
  form.elements.remember.checked = false;
  $("[data-remembered]").hidden = true;
  form.elements.name.focus();
});
prefillRemembered();

/* ─── Añadir al calendario (.ics) ─── */
let lastBooking = null;
$("[data-ics]").addEventListener("click", () => {
  if (!lastBooking) return;
  const [y, mo, d] = lastBooking.fecha.split("-").map(Number);
  const start = new Date(y, mo - 1, d, 0, lastBooking.minutes);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gulateria//Reservas//ES", "BEGIN:VEVENT",
    `UID:${Date.now()}@gulateria`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:Gulateria · mesa para ${lastBooking.personas}`,
    "LOCATION:C. Realenga de San Luis\\, 12\\, 29004 Málaga",
    `DESCRIPTION:Reserva a nombre de ${lastBooking.nombre}.`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "reserva-gulateria.ics";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ─── Navegación: sección activa ─── */
const navLinks = $$("[data-section]");
const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.setAttribute("aria-current", a.dataset.section === e.target.id ? "true" : "false"));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
navLinks.forEach((a) => { const sec = document.getElementById(a.dataset.section); if (sec) sectionObs.observe(sec); });
const resetNavObs = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) navLinks.forEach((a) => a.setAttribute("aria-current", "false"));
}), { rootMargin: "-45% 0px -50% 0px" });
[$(".hero"), $("#reservas")].forEach((el) => resetNavObs.observe(el));

/* ─── Barra de reserva en móvil ─── */
const dock = $("[data-dock]");
const seen = { quick: true, reserve: false, foot: false };
const dockObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => { seen[e.target.dataset.dockWatch] = e.isIntersecting; });
  const show = !seen.quick && !seen.reserve && !seen.foot;
  dock.toggleAttribute("data-show", show);
  dock.setAttribute("aria-hidden", show ? "false" : "true");
  $("a", dock).tabIndex = show ? 0 : -1;
});
[[quick, "quick"], [$("#reservas"), "reserve"], [$(".foot"), "foot"]].forEach(([el, k]) => { el.dataset.dockWatch = k; dockObs.observe(el); });

/* ─── Animaciones al hacer scroll ─── */
function tag(sel, kind, stagger = false) {
  $$(sel).forEach((el, i) => { el.dataset.reveal = kind; if (stagger) el.style.setProperty("--i", i); });
}
tag("main section:not(.hero) h2", "rise");
tag(".about-intro p, .reserve-head p, .contact-lead, .where address", "rise");
tag(".without li", "wipe", true);
tag(".menu", "card");
tag(".menu-list li", "row", true);
tag(".reserve-shell", "card");
tag(".hours tbody tr", "row", true);
tag(".map-card", "map");
tag(".contact-list li", "card", true);

// Clipped elements have no visible area to intersect, so watch their parent instead.
const watchers = new Map();
$$("[data-reveal]").forEach((el) => {
  if (el.closest("[hidden]")) { el.classList.add("is-in"); return; }
  const clipped = el.dataset.reveal === "wipe" || el.dataset.reveal === "map";
  const target = clipped ? el.parentElement : el;
  if (!watchers.has(target)) watchers.set(target, []);
  watchers.get(target).push(el);
});
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    watchers.get(e.target).forEach((el) => el.classList.add("is-in"));
    revealObs.unobserve(e.target);
  });
}, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
watchers.forEach((_, target) => revealObs.observe(target));

/* ─── Cucurucho: flota y se inclina hacia el cursor ─── */
(function cone() {
  const stage = $("[data-cone]");
  if (!stage || reduceMotion) return;
  setTimeout(() => stage.classList.add("is-floating"), 1900);
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const hero = $(".hero");
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, visible = true;
  hero.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 500));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 500));
    if (!raf) raf = requestAnimationFrame(tick);
  });
  hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  function tick() {
    // spring-ish follow: ease toward the target each frame
    x += (tx - x) * 0.08; y += (ty - y) * 0.08;
    stage.style.transform = `translate(${x * 12}px, ${y * 8}px) rotate(${x * 6}deg)`;
    raf = visible && (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) ? requestAnimationFrame(tick) : 0;
  }
})();

/* ─── Confeti de virutas al confirmar ─── */
function sprinkles() {
  if (reduceMotion || !ticket.animate) return;
  const colors = ["#2B2B2B", "#9A9A9A", "#D6D6D6", "#555555"];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.className = "sprinkle";
    s.style.background = colors[i % colors.length];
    ticket.append(s);
    const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
    const dist = 70 + Math.random() * 90;
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist * 0.8 - 20;
    const rot = Math.random() * 540 - 270;
    s.animate([
      { transform: "translate(-50%, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), ${dy + 40}px) rotate(${rot * 1.2}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 300, delay: 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" })
      .finished.then(() => s.remove());
  }
}
const _showTicket = showTicket;
showTicket = function (data, mode) { _showTicket(data, mode); sprinkles(); };

/* ─── Portada + secciones (una vista a la vez) ─── */
const views = Object.fromEntries($$("[data-view]").map((v) => [v.dataset.view, v]));
const viewsEl = $("[data-views]");
let current = "inicio";
let leaveTimer = 0;
const TITLES = { inicio: "Gulateria · Heladería artesanal en Málaga", reservas: "Reservar mesa · Gulateria", ubicacion: "Ubicación y horario · Gulateria", contacto: "Contacto · Gulateria" };

function go(name, { push = true, instant = false } = {}) {
  // Nosotros vive dentro de la portada: ir a la portada y bajar hasta el bloque
  if (name === "nosotros") {
    go("inicio", { push, instant });
    setTimeout(() => $("#nosotros").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }), instant ? 0 : 500);
    return;
  }
  if (!views[name]) name = "inicio";
  closeMenu();
  if (push && location.hash !== `#${name}`) history.pushState(null, "", `#${name}`);
  document.title = TITLES[name];
  $$("[data-go]").forEach((a) => a.setAttribute("aria-current", a.dataset.go === name ? "page" : "false"));
  $("[data-nav-cta]").hidden = name === "reservas";
  if (name === current) { if (!instant) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); return; }
  const from = views[current], to = views[name];
  current = name;

  // finish any transition still running
  clearTimeout(leaveTimer);
  $$(".view.is-leaving").forEach((v) => { v.classList.remove("is-leaving"); v.hidden = true; });
  $$(".view.is-entering").forEach((v) => v.classList.remove("is-entering"));

  window.scrollTo(0, 0);
  to.hidden = false;
  if (instant) { from.hidden = true; return; }
  viewsEl.toggleAttribute("data-busy", true);
  from.classList.add("is-leaving");
  void to.offsetWidth;
  to.classList.add("is-entering");
  leaveTimer = setTimeout(() => {
    from.classList.remove("is-leaving"); from.hidden = true;
    viewsEl.removeAttribute("data-busy");
  }, reduceMotion ? 220 : 440);
  to.addEventListener("animationend", function done(e) {
    if (e.target !== to) return;
    to.classList.remove("is-entering");
    to.removeEventListener("animationend", done);
  });
  const heading = $("h1, h2", to);
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const name = a.getAttribute("href").slice(1);
  if (!views[name] && name !== "nosotros") return;
  e.preventDefault();
  go(name);
});
window.addEventListener("popstate", () => go(location.hash.slice(1) || "inicio", { push: false }));

/* Menú de tres barras */
const burger = $("[data-burger]"), menu = $("[data-menu]");
$$(".menu-links li").forEach((li, i) => li.style.setProperty("--i", i));
let menuTimer = 0;
function openMenu() {
  clearTimeout(menuTimer);
  $("[data-menu-status]").textContent = openStatus().text;
  menu.hidden = false; void menu.offsetWidth;
  menu.classList.add("is-open");
  document.body.classList.add("menu-open");
  burger.setAttribute("aria-expanded", "true"); burger.setAttribute("aria-label", "Cerrar menú");
  setTimeout(() => $('.menu-links a[aria-current="page"], .menu-links a', menu).focus({ preventScroll: true }), 120);
}
function closeMenu() {
  if (!menu.classList.contains("is-open")) return;
  menu.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  burger.setAttribute("aria-expanded", "false"); burger.setAttribute("aria-label", "Abrir menú");
  menuTimer = setTimeout(() => { menu.hidden = true; }, reduceMotion ? 200 : 400);
}
burger.addEventListener("click", () => (menu.classList.contains("is-open") ? closeMenu() : openMenu()));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("is-open")) { closeMenu(); burger.focus(); } });

// Vista inicial según la URL
go(location.hash.slice(1) || "inicio", { push: false, instant: true });
