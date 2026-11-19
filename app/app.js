// Leonida Trophy Atlas: renders the roadmap and the trophy checklist from the
// data files, and wires up search, filters, the spoiler setting and progress.
// Runs fully offline: its only fetch is the app's own data files.

import { loadEarned, saveEarned, gradeProgress, exportProgress, importProgress } from './tracker.js';

const KINDS = [
  { key: 'all', label: 'All' },
  { key: 'story', label: 'Story' },
  { key: 'missable', label: 'Missable' },
  { key: 'collectibles', label: 'Collectibles' },
  { key: 'activities', label: 'Activities' },
  { key: 'side', label: 'Side quests' },
  { key: 'crime', label: 'Crime' },
  { key: 'misc', label: 'Misc' },
];
const KIND_LABELS = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));

const trophiesDoc = await (await fetch('data/trophies.json')).json();
const roadmapDoc = await (await fetch('data/roadmap.json')).json();
const trophies = trophiesDoc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));
const knownIds = new Set(trophies.map((t) => t.id));

const earned = loadEarned(knownIds);
let activeKind = 'all';
let spoilerOn = false;
const openGuides = new Set();

const listEl = document.getElementById('trophy-list');
const metaEl = document.getElementById('list-meta');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade-select');
const hideEarnedEl = document.getElementById('hide-earned');
const spoilerEl = document.getElementById('spoiler-toggle');

/** Spoiler-safe mode hides a story trophy's name, description and guide
 *  until the reader has earned it. */
function isMasked(trophy) {
  return spoilerOn && trophy.kind === 'story' && !earned.has(trophy.id);
}

function renderProgress() {
  const pct = Math.round((earned.size / trophies.length) * 100);
  document.getElementById('progress-text').textContent = `${earned.size} of ${trophies.length} earned`;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  const counts = gradeProgress(trophies, earned);
  document.getElementById('grade-counts').textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((grade) => `${grade}: ${counts[grade].earned}/${counts[grade].total}`)
    .join(' · ');
}

function renderRoadmap() {
  document.getElementById('roadmap-summary').textContent = roadmapDoc.summary;
  const stagesEl = document.getElementById('stages');
  stagesEl.replaceChildren();
  for (const stage of roadmapDoc.stages) {
    const card = document.createElement('article');
    card.className = 'stage';
    const heading = document.createElement('h3');
    heading.textContent = stage.title;
    const hours = document.createElement('p');
    hours.className = 'stage-hours';
    hours.textContent = stage.hours;
    const body = document.createElement('p');
    body.textContent = stage.body;
    card.append(heading, hours, body);
    if (stage.warning) {
      const warning = document.createElement('p');
      warning.className = 'stage-warning';
      warning.textContent = stage.warning;
      card.append(warning);
    }
    const chips = document.createElement('div');
    chips.className = 'stage-trophies';
    for (const id of stage.trophies) {
      const trophy = byId.get(id);
      const chip = document.createElement('a');
      chip.href = `#trophy-${id}`;
      chip.textContent = trophy.name;
      chip.addEventListener('click', () => openGuides.add(id));
      chips.append(chip);
    }
    card.append(chips);
    stagesEl.append(card);
  }
}

function trophyMatches(trophy) {
  if (activeKind === 'missable') {
    if (!trophy.missable) return false;
  } else if (activeKind !== 'all' && trophy.kind !== activeKind) {
    return false;
  }
  if (gradeEl.value !== 'all' && trophy.grade !== gradeEl.value) return false;
  if (hideEarnedEl.checked && earned.has(trophy.id)) return false;
  const query = searchEl.value.trim().toLowerCase();
  if (query) {
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function renderCard(trophy) {
  const masked = isMasked(trophy);
  const card = document.createElement('article');
  card.className = 'card' + (earned.has(trophy.id) ? ' earned' : '');
  card.id = `trophy-${trophy.id}`;

  const tick = document.createElement('input');
  tick.className = 'tick';
  tick.type = 'checkbox';
  tick.checked = earned.has(trophy.id);
  tick.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  tick.addEventListener('change', () => {
    if (tick.checked) earned.add(trophy.id);
    else earned.delete(trophy.id);
    saveEarned(earned);
    renderProgress();
    renderList();
  });

  const head = document.createElement('div');
  head.className = 'card-head';
  const name = document.createElement('h3');
  name.textContent = masked ? 'Hidden story trophy' : trophy.name;
  if (masked) name.classList.add('masked');
  if (earned.has(trophy.id)) {
    const mark = document.createElement('span');
    mark.className = 'earned-mark';
    mark.textContent = ' ✓ earned';
    name.append(mark);
  }
  const grade = document.createElement('span');
  grade.className = `grade-badge grade-${trophy.grade}`;
  grade.textContent = trophy.grade;
  const kind = document.createElement('span');
  kind.className = 'kind-tag';
  kind.textContent = KIND_LABELS[trophy.kind] ?? trophy.kind;
  head.append(name, grade, kind);
  if (trophy.hidden) {
    const hidden = document.createElement('span');
    hidden.className = 'hidden-tag';
    hidden.textContent = 'Hidden on PSN';
    head.append(hidden);
  }
  if (trophy.missable) {
    const flag = document.createElement('span');
    flag.className = 'missable-flag';
    flag.textContent = '⚠ Missable';
    head.append(flag);
  }

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  if (masked) {
    desc.textContent = 'Hidden until earned — spoiler-safe mode is on.';
    desc.classList.add('masked');
  } else {
    desc.textContent = trophy.description + ' ';
    const official = document.createElement('span');
    official.className = 'official';
    official.textContent = '(official description)';
    desc.append(official);
  }

  card.append(tick, head, desc);
  if (!masked) {
    const toggle = document.createElement('button');
    toggle.className = 'guide-toggle';
    toggle.type = 'button';
    toggle.textContent = openGuides.has(trophy.id) ? 'Hide guide' : 'Show guide';
    toggle.addEventListener('click', () => {
      if (openGuides.has(trophy.id)) openGuides.delete(trophy.id);
      else openGuides.add(trophy.id);
      renderList();
    });
    card.append(toggle);
    if (openGuides.has(trophy.id)) {
      const guide = document.createElement('div');
      guide.className = 'guide';
      const text = document.createElement('p');
      text.textContent = trophy.guide;
      const sources = document.createElement('p');
      sources.className = 'sources';
      const label = document.createElement('strong');
      label.textContent = 'Sources: ';
      sources.append(label, document.createTextNode(trophy.sources.join(' · ')));
      guide.append(text, sources);
      card.append(guide);
    }
  }
  return card;
}

function renderList() {
  const shown = trophies.filter(trophyMatches);
  listEl.replaceChildren(...shown.map(renderCard));
  metaEl.textContent = `Showing ${shown.length} of ${trophies.length} trophies` +
    (spoilerOn ? ' · spoiler-safe mode on: story trophies stay hidden until earned' : '');
}

function renderKindChips() {
  const chipsEl = document.getElementById('kind-chips');
  chipsEl.replaceChildren();
  for (const kind of KINDS) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (kind.key === activeKind ? ' active' : '');
    chip.type = 'button';
    chip.textContent = kind.label;
    chip.addEventListener('click', () => {
      activeKind = kind.key;
      renderKindChips();
      renderList();
    });
    chipsEl.append(chip);
  }
}

document.getElementById('export-btn').addEventListener('click', () => exportProgress(earned));
document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = await importProgress(file, knownIds);
    earned.clear();
    for (const id of imported) earned.add(id);
    saveEarned(earned);
    renderProgress();
    renderList();
  } catch {
    metaEl.textContent = 'That file is not a Leonida Trophy Atlas progress file — nothing was imported.';
  }
  event.target.value = '';
});
searchEl.addEventListener('input', renderList);
gradeEl.addEventListener('change', renderList);
hideEarnedEl.addEventListener('change', renderList);
spoilerEl.addEventListener('change', () => {
  spoilerOn = spoilerEl.checked;
  renderList();
});

renderProgress();
renderRoadmap();
renderKindChips();
renderList();
