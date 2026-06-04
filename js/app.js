/* =========================================================================
   NMRY Coaching — logique de l'application (vues + interactions)
   ========================================================================= */

const view = document.getElementById('view');
const appTitle = document.getElementById('appTitle');
const backBtn = document.getElementById('backBtn');
const overlay = document.getElementById('modalOverlay');
const modal = document.getElementById('modal');

const state = Store.get();
let currentRoute = 'home';
let planMode = 'month'; // 'month' | 'week'
let cursorDate = new Date(); // mois/semaine affiché

// ---- utilitaires ----------------------------------------------------------
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// =========================================================================
// ROUTAGE
// =========================================================================
const routes = {
  home:     { title: 'NMRY',       render: renderHome,     back: false },
  profile:  { title: 'Profil',     render: renderProfile,  back: true },
  plan:     { title: 'Planning',   render: renderPlan,     back: true },
  goals:    { title: 'Objectifs',  render: renderGoals,    back: true },
  followup: { title: 'Suivi',      render: renderFollowup, back: true },
};

function go(route) {
  currentRoute = route;
  const r = routes[route];
  appTitle.textContent = r.title;
  backBtn.classList.toggle('show', !!r.back);
  r.render();
  window.scrollTo(0, 0);
}

backBtn.addEventListener('click', () => go('home'));

// =========================================================================
// ACCUEIL — 4 carrés
// =========================================================================
function renderHome() {
  const cards = [
    { key: 'profile',  icon: '👤', label: 'Profil & Diète',  sub: 'Infos perso, objectif poids, plan alimentaire' },
    { key: 'plan',     icon: '🗓️', label: "Plan d'entraînement", sub: 'Vue mois / semaine, glisser-déposer' },
    { key: 'goals',    icon: '🎯', label: 'Objectifs',       sub: 'Compétitions & performances visées' },
    { key: 'followup', icon: '📝', label: 'Suivi perso',     sub: 'Commentaires, blessures, ressenti' },
  ];
  view.innerHTML = `
    <div class="home-grid">
      ${cards.map((c) => `
        <div class="home-card" data-key="${c.key}">
          <div class="icon">${c.icon}</div>
          <div>
            <div class="label">${c.label}</div>
            <div class="sub">${c.sub}</div>
          </div>
        </div>`).join('')}
    </div>`;
  view.querySelectorAll('.home-card').forEach((el) =>
    el.addEventListener('click', () => go(el.dataset.key)));
}

// =========================================================================
// 1) PROFIL & DIÈTE
// =========================================================================
function renderProfile() {
  const p = state.profile;
  view.innerHTML = `
    <div class="card">
      <div class="section-title">Informations</div>
      <label class="field"><span>Nom</span><input id="p-name" value="${esc(p.name)}" placeholder="Prénom Nom"></label>
      <div class="ex-grid">
        <label class="field"><span>Âge</span><input id="p-age" type="number" value="${esc(p.age)}" placeholder="ans"></label>
        <label class="field"><span>Taille (cm)</span><input id="p-height" type="number" value="${esc(p.height)}" placeholder="cm"></label>
        <label class="field"><span>Poids actuel (kg)</span><input id="p-weight" type="number" value="${esc(p.weight)}" placeholder="kg"></label>
        <label class="field"><span>Poids objectif (kg)</span><input id="p-goalWeight" type="number" value="${esc(p.goalWeight)}" placeholder="kg"></label>
      </div>
    </div>
    <div class="card">
      <div class="section-title">Diète à suivre</div>
      <label class="field"><span>Plan alimentaire (renseigné par le coach)</span>
        <textarea id="p-diet" placeholder="Petit-déj, déjeuner, collation, dîner, macros...">${esc(p.diet)}</textarea>
      </label>
    </div>
    <button class="btn full" id="p-save">Enregistrer</button>`;

  view.querySelector('#p-save').addEventListener('click', () => {
    p.name = val('#p-name'); p.age = val('#p-age'); p.height = val('#p-height');
    p.weight = val('#p-weight'); p.goalWeight = val('#p-goalWeight'); p.diet = val('#p-diet');
    Store.save();
    toast('Profil enregistré ✓');
  });
}

// =========================================================================
// 2) PLAN D'ENTRAÎNEMENT — vue mois/semaine + drag & drop
// =========================================================================
function renderPlan() {
  view.innerHTML = `
    <div class="plan-toolbar">
      <div class="toggle">
        <button data-mode="month" class="${planMode==='month'?'active':''}">Mois</button>
        <button data-mode="week" class="${planMode==='week'?'active':''}">Semaine</button>
      </div>
      <div class="nav-month">
        <button id="prev">‹</button>
        <span class="label" id="periodLabel"></span>
        <button id="next">›</button>
      </div>
    </div>
    <div class="lib-hint">Glisse une séance sur un jour. Sur mobile : appuie sur une séance puis sur le jour cible.</div>
    <div class="library" id="library"></div>
    <div id="planBody"></div>`;

  view.querySelectorAll('.toggle button').forEach((b) =>
    b.addEventListener('click', () => { planMode = b.dataset.mode; renderPlan(); }));
  view.querySelector('#prev').addEventListener('click', () => { shiftPeriod(-1); renderPlan(); });
  view.querySelector('#next').addEventListener('click', () => { shiftPeriod(1); renderPlan(); });

  renderLibrary();
  if (planMode === 'month') renderMonth(); else renderWeek();
}

function shiftPeriod(dir) {
  if (planMode === 'month') cursorDate.setMonth(cursorDate.getMonth() + dir);
  else cursorDate.setDate(cursorDate.getDate() + dir * 7);
}

let pendingTemplate = null; // pour le tap-to-place mobile

function renderLibrary() {
  const lib = view.querySelector('#library');
  lib.innerHTML = SESSION_TEMPLATES.map((t) => `
    <div class="lib-chip" draggable="true" data-tpl="${t.id}" style="--chip:${t.color}">${esc(t.name)}</div>`).join('');
  lib.querySelectorAll('.lib-chip').forEach((chip) => {
    chip.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/tpl', chip.dataset.tpl));
    chip.addEventListener('click', () => {
      pendingTemplate = pendingTemplate === chip.dataset.tpl ? null : chip.dataset.tpl;
      lib.querySelectorAll('.lib-chip').forEach((c) => c.style.outline = '');
      if (pendingTemplate) chip.style.outline = '2px solid var(--accent)';
    });
  });
}

// Crée une instance de séance (copie indépendante du modèle)
function instanceFromTemplate(tplId) {
  const t = TEMPLATE_BY_ID[tplId];
  return {
    id: uid(),
    tplId: t.id,
    name: t.name,
    color: t.color,
    exercises: t.exercises.map((ex) => ({
      uid: uid(),
      exId: ex.exId,
      sets: ex.sets, reps: ex.reps, weight: ex.weight, rpe: ex.rpe,
      validated: false,
    })),
  };
}

function dropOnDay(dateKey, tplId) {
  if (!tplId) return;
  (state.planning[dateKey] ||= []).push(instanceFromTemplate(tplId));
  Store.save();
  pendingTemplate = null;
  renderPlan();
}

function bindDayDnd(el, dateKey) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault(); el.classList.remove('drag-over');
    dropOnDay(dateKey, e.dataTransfer.getData('text/tpl'));
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('.sess-pill')) return; // clic sur séance = édition
    if (pendingTemplate) dropOnDay(dateKey, pendingTemplate);
  });
}

function renderMonth() {
  const body = view.querySelector('#planBody');
  view.querySelector('#periodLabel').textContent = `${MONTHS[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`;

  const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0).getDate();
  const todayKey = ymd(new Date());

  let cells = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-day dim"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), day);
    const key = ymd(date);
    const sessions = state.planning[key] || [];
    const pills = sessions.map((s) =>
      `<div class="sess-pill" data-key="${key}" data-id="${s.id}" style="--p:${s.color}">${esc(shortName(s.name))}</div>`).join('');
    cells += `<div class="cal-day ${key===todayKey?'today':''}" data-key="${key}">
      <div class="cal-daynum">${day}</div>${pills}</div>`;
  }
  body.innerHTML = `<div class="calendar">${cells}</div>`;

  body.querySelectorAll('.cal-day:not(.dim)').forEach((el) => bindDayDnd(el, el.dataset.key));
  bindPills(body);
}

function renderWeek() {
  const body = view.querySelector('#planBody');
  // lundi de la semaine courante
  const monday = new Date(cursorDate);
  monday.setDate(cursorDate.getDate() - ((cursorDate.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  view.querySelector('#periodLabel').textContent =
    `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0,3)} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()].slice(0,3)}`;

  const todayKey = ymd(new Date());
  let html = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    const key = ymd(date);
    const sessions = state.planning[key] || [];
    const list = sessions.length
      ? sessions.map((s) => `<div class="sess-pill" data-key="${key}" data-id="${s.id}" style="--p:${s.color}">${esc(s.name)}</div>`).join('')
      : '<div class="week-empty">Repos / rien de prévu</div>';
    html += `<div class="week-day ${key===todayKey?'today':''}" data-key="${key}">
      <h3>${DOW[i]} <span class="d">${date.getDate()} ${MONTHS[date.getMonth()].slice(0,3)}</span></h3>
      <div class="week-sessions">${list}</div></div>`;
  }
  html += '</div>';
  body.innerHTML = html;

  body.querySelectorAll('.week-day').forEach((el) => bindDayDnd(el, el.dataset.key));
  bindPills(body);
}

function bindPills(scope) {
  scope.querySelectorAll('.sess-pill').forEach((p) =>
    p.addEventListener('click', (e) => {
      e.stopPropagation();
      openSessionEditor(p.dataset.key, p.dataset.id);
    }));
}
function shortName(n) { return n.split('(')[0].trim(); }

// ---- Éditeur de séance (modale) ----
function openSessionEditor(dateKey, sessionId) {
  const sessions = state.planning[dateKey] || [];
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  function draw() {
    modal.innerHTML = `
      <button class="modal-close" data-act="close">✕</button>
      <h2 style="border-left:5px solid ${session.color};padding-left:10px">${esc(session.name)}</h2>
      <p style="color:var(--text-dim);font-size:13px;margin-top:4px">${frenchDate(dateKey)}</p>
      <div id="exList">
        ${session.exercises.map((ex) => exerciseBlock(ex)).join('')}
      </div>
      <div class="add-ex-row">
        <select id="addExSelect">${EXERCISES.map((e)=>`<option value="${e.id}">${esc(e.name)} · ${esc(e.group)}</option>`).join('')}</select>
        <button class="btn small" data-act="addEx">+ Exercice</button>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn full" data-act="save">Enregistrer</button>
        <button class="btn danger" data-act="delete">Supprimer la séance</button>
      </div>`;

    // sliders <-> champ poids synchronisés
    modal.querySelectorAll('[data-ex]').forEach((block) => {
      const exUid = block.dataset.ex;
      const ex = session.exercises.find((x) => x.uid === exUid);
      const range = block.querySelector('input[type=range]');
      const num = block.querySelector('.weight-num');
      range.addEventListener('input', () => { num.value = range.value; ex.weight = +range.value; });
      num.addEventListener('input', () => { range.value = num.value || 0; ex.weight = +num.value || 0; });
      block.querySelector('.ex-sets').addEventListener('input', (e) => ex.sets = +e.target.value || 0);
      block.querySelector('.ex-reps').addEventListener('input', (e) => ex.reps = +e.target.value || 0);
      const rpe = block.querySelector('.ex-rpe');
      const rpeBadge = block.querySelector('.rpe-badge');
      rpe.addEventListener('input', () => { ex.rpe = +rpe.value; rpeBadge.textContent = ex.rpe + '/10'; });
      const valBox = block.querySelector('.validate');
      const chk = block.querySelector('.ex-valid');
      chk.addEventListener('change', () => { ex.validated = chk.checked; valBox.classList.toggle('ok', chk.checked); });
      block.querySelector('[data-act="removeEx"]').addEventListener('click', () => {
        session.exercises = session.exercises.filter((x) => x.uid !== exUid);
        draw();
      });
    });

    modal.querySelector('[data-act="addEx"]').addEventListener('click', () => {
      const exId = modal.querySelector('#addExSelect').value;
      session.exercises.push({ uid: uid(), exId, sets: 3, reps: 10, weight: 20, rpe: 8, validated: false });
      draw();
    });
    modal.querySelector('[data-act="save"]').addEventListener('click', () => {
      Store.save(); closeModal(); renderPlan(); toast('Séance enregistrée ✓');
    });
    modal.querySelector('[data-act="delete"]').addEventListener('click', () => {
      state.planning[dateKey] = sessions.filter((s) => s.id !== sessionId);
      if (!state.planning[dateKey].length) delete state.planning[dateKey];
      Store.save(); closeModal(); renderPlan();
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', closeModal);
  }
  draw();
  openModal();
}

function exerciseBlock(ex) {
  const name = EXERCISE_BY_ID[ex.exId]?.name || ex.exId;
  return `
    <div class="ex-block" data-ex="${ex.uid}">
      <div class="ex-head">
        <span class="name">${esc(name)}</span>
        <button class="btn secondary small" data-act="removeEx">✕</button>
      </div>
      <div class="ex-grid">
        <label class="field"><span>Séries</span><input class="ex-sets" type="number" min="0" value="${ex.sets}"></label>
        <label class="field"><span>Répétitions</span><input class="ex-reps" type="number" min="0" value="${ex.reps}"></label>
      </div>
      <label class="field"><span>Poids (kg)</span>
        <div class="weight-row">
          <input type="range" min="0" max="300" step="1" value="${ex.weight}">
          <input class="weight-num" type="number" min="0" value="${ex.weight}">
        </div>
      </label>
      <div class="rpe-line">
        <span style="font-size:13px;color:var(--text-dim)">RPE (coach)</span>
        <span class="rpe-badge">${ex.rpe}/10</span>
        <input class="ex-rpe" type="range" min="1" max="10" step="1" value="${ex.rpe}" style="flex:1">
      </div>
      <div class="validate ${ex.validated?'ok':''}">
        <input class="ex-valid" type="checkbox" ${ex.validated?'checked':''} id="v-${ex.uid}">
        <label for="v-${ex.uid}">Validé par le client</label>
      </div>
    </div>`;
}

// =========================================================================
// 3) OBJECTIFS
// =========================================================================
function renderGoals() {
  const items = state.goals;
  view.innerHTML = `
    <div class="card">
      <div class="section-title">Nouvel objectif</div>
      <label class="field"><span>Nom de la compétition</span><input id="g-comp" placeholder="Ex : Championnat régional"></label>
      <div class="ex-grid">
        <label class="field"><span>Date</span><input id="g-date" type="date"></label>
        <label class="field"><span>Lieu</span><input id="g-place" placeholder="Ville / salle"></label>
      </div>
      <label class="field"><span>Performances attendues</span><textarea id="g-exp" placeholder="Ex : Squat 180kg, Bench 120kg, Deadlift 220kg"></textarea></label>
      <button class="btn full" id="g-add">Ajouter l'objectif</button>
    </div>
    <div class="section-title">Mes objectifs</div>
    <div id="g-list">${goalsList(items)}</div>`;

  view.querySelector('#g-add').addEventListener('click', () => {
    const comp = val('#g-comp');
    if (!comp) return toast('Renseigne au moins le nom.');
    items.unshift({ id: uid(), competition: comp, date: val('#g-date'), place: val('#g-place'), expected: val('#g-exp') });
    Store.save(); renderGoals();
  });
  bindGoalDelete();
}
function goalsList(items) {
  if (!items.length) return `<div class="empty">Aucun objectif pour l'instant.</div>`;
  return items.map((g) => `
    <div class="list-item">
      <div class="row" style="justify-content:space-between">
        <strong>${esc(g.competition)}</strong>
        <button class="btn danger small" data-del="${g.id}">Suppr.</button>
      </div>
      <div class="meta">${g.date ? frenchDate(g.date) : 'Date ?'} · ${esc(g.place || 'Lieu ?')}</div>
      ${g.expected ? `<p style="margin:8px 0 0">${esc(g.expected)}</p>` : ''}
    </div>`).join('');
}
function bindGoalDelete() {
  view.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      state.goals = state.goals.filter((g) => g.id !== b.dataset.del);
      Store.save(); renderGoals();
    }));
}

// =========================================================================
// 4) SUIVI PERSONNALISÉ
// =========================================================================
function renderFollowup() {
  const items = state.followups;
  view.innerHTML = `
    <div class="card">
      <div class="section-title">Nouvelle entrée</div>
      <label class="field"><span>Type</span>
        <select id="f-type"><option value="note">Commentaire / ressenti</option><option value="injury">Blessure</option></select>
      </label>
      <label class="field"><span>Détails</span><textarea id="f-text" placeholder="Décris ton ressenti, une douleur, une blessure..."></textarea></label>
      <button class="btn full" id="f-add">Ajouter</button>
    </div>
    <div class="section-title">Historique</div>
    <div id="f-list">${followList(items)}</div>`;

  view.querySelector('#f-add').addEventListener('click', () => {
    const text = val('#f-text');
    if (!text) return toast('Écris quelque chose.');
    items.unshift({ id: uid(), date: ymd(new Date()), type: val('#f-type'), text });
    Store.save(); renderFollowup();
  });
  view.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      state.followups = state.followups.filter((f) => f.id !== b.dataset.del);
      Store.save(); renderFollowup();
    }));
}
function followList(items) {
  if (!items.length) return `<div class="empty">Aucune entrée pour l'instant.</div>`;
  return items.map((f) => `
    <div class="list-item">
      <div class="row" style="justify-content:space-between;align-items:center">
        <span class="tag ${f.type}">${f.type === 'injury' ? 'Blessure' : 'Note'}</span>
        <button class="btn danger small" data-del="${f.id}">Suppr.</button>
      </div>
      <div class="meta" style="margin-top:6px">${frenchDate(f.date)}</div>
      <p style="margin:8px 0 0">${esc(f.text)}</p>
    </div>`).join('');
}

// =========================================================================
// Helpers UI
// =========================================================================
function val(sel) { return view.querySelector(sel).value.trim(); }
function openModal() { overlay.hidden = false; }
function closeModal() { overlay.hidden = true; modal.innerHTML = ''; }
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

function frenchDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface-2);color:var(--text);padding:12px 18px;border-radius:10px;border:1px solid var(--border);z-index:100;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.4)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
}

// Démarrage
go('home');
