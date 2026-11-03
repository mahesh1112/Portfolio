// Project popups and illustrative playback. No project services are executed.
const workflowPlayers = new Map();
const workflowMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionIsPaused = () => workflowMotion.matches || document.documentElement.classList.contains('motion-paused');

// Draws a diagram piece by piece, as if it were being built live in an editor.
// Every interruption calls complete(), which restores the original markup exactly.
function createDiagramBuilder(svg, nodes, edges) {
  const ns = 'http://www.w3.org/2000/svg';
  const box = node => node.querySelector('rect');
  const texts = new Map([...svg.querySelectorAll('text')].map(text => [text, text.textContent]));
  const markers = new Map(edges.map(edge => [edge, edge.getAttribute('marker-end')]));
  const lanes = [...svg.querySelectorAll('.diagram-lane')].map(lane => ({ lane, y: Number(lane.getAttribute('y')) })).sort((a, b) => a.y - b.y);
  const laneOf = node => lanes.filter(({ y }) => y < Number(box(node).getAttribute('y'))).at(-1)?.lane;
  // Generated markup places each connector label directly after its connector.
  const edgeLabels = new Map();
  svg.querySelectorAll('.diagram-edge-label').forEach(label => {
    const edge = label.previousElementSibling;
    if (edge?.classList.contains('diagram-edge')) edgeLabels.set(edge, [...(edgeLabels.get(edge) || []), label]);
  });
  const pieces = [...nodes, ...edges, ...svg.querySelectorAll('.diagram-lane, .diagram-edge-label')];
  const cursor = document.createElementNS(ns, 'g');
  cursor.setAttribute('class', 'build-cursor');
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<circle class="build-cursor-ring" r="10"/><path d="M0 0 V16 L4.2 12 L7.4 19 L10.4 17.7 L7.3 11 H12.8 Z"/>';
  const ring = cursor.firstElementChild;
  const running = new Set();
  let abort = null;
  let at = { x: 0, y: 0 };

  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, { fill: 'none', ...options });
    running.add(animation);
    const done = () => running.delete(animation);
    animation.finished.then(done, done);
    return animation.finished;
  }
  function wait(ms) {
    const { signal } = abort;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }
  function moveCursor(x, y, duration, easing = 'cubic-bezier(.45,0,.2,1)') {
    const from = `translate(${at.x}px, ${at.y}px)`;
    at = { x, y };
    return animate(cursor, [{ transform: from }, { transform: `translate(${x}px, ${y}px)` }], { duration, easing, fill: 'forwards' });
  }
  async function type(text, duration) {
    const full = texts.get(text);
    text.classList.remove('build-pending');
    const delay = duration / Math.max(full.length, 1);
    for (let i = 1; i <= full.length; i++) {
      text.textContent = full.slice(0, i) + (i < full.length ? '▍' : '');
      await wait(delay);
    }
  }
  async function drawEdge(edge, unit) {
    const length = edge.getTotalLength();
    edge.removeAttribute('marker-end');
    edge.style.strokeDasharray = `${length} ${length}`;
    edge.classList.remove('build-pending');
    await animate(edge, [{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: unit * .55, easing: 'ease-in-out' });
    // Dashed connector styles return once the stroke has been drawn.
    edge.style.strokeDasharray = '';
    if (markers.get(edge)) edge.setAttribute('marker-end', markers.get(edge));
    animate(edge, [{ stroke: '#67e8f9', strokeWidth: 2.4, offset: 0 }], { duration: unit * .6, easing: 'ease-out' });
    for (const label of edgeLabels.get(edge) || []) {
      label.classList.remove('build-pending');
      animate(label, [{ opacity: 0 }, { opacity: 1 }], { duration: unit * .4 });
    }
  }
  async function buildNode(node, unit) {
    const rect = box(node);
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    const width = Number(rect.getAttribute('width'));
    const height = Number(rect.getAttribute('height'));
    const [label, sub] = node.querySelectorAll('text');
    await moveCursor(x, y, unit * .3);
    animate(ring, [{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: unit * .35, easing: 'ease-out' });
    // Drag out the box from its top-left corner, like drawing a shape.
    node.classList.remove('build-pending');
    label?.classList.add('build-pending');
    sub?.classList.add('build-pending');
    rect.style.transformOrigin = `${x}px ${y}px`;
    moveCursor(x + width, y + height, unit * .3, 'cubic-bezier(.3,.7,.4,1)');
    await animate(rect, [{ transform: 'scale(.04, .1)', opacity: .5 }, { transform: 'scale(1)', opacity: 1 }], { duration: unit * .3, easing: 'cubic-bezier(.3,.7,.4,1)' });
    rect.style.transformOrigin = '';
    animate(rect, [{ stroke: '#67e8f9', strokeWidth: 2.5, offset: 0 }], { duration: unit * .8, easing: 'ease-out' });
    moveCursor(x + width - 10, Number(label?.getAttribute('y') ?? y) - 4, unit * .15);
    if (label) await type(label, unit * .3);
    if (sub) {
      sub.classList.remove('build-pending');
      animate(sub, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: unit * .3, easing: 'ease-out' });
    }
  }
  function complete() {
    abort?.abort(new DOMException('Diagram build interrupted', 'AbortError'));
    abort = null;
    running.forEach(animation => animation.cancel());
    texts.forEach((value, text) => { text.textContent = value; });
    markers.forEach((value, edge) => { edge.style.strokeDasharray = ''; if (value) edge.setAttribute('marker-end', value); });
    nodes.forEach(node => { box(node).style.transformOrigin = ''; });
    svg.querySelectorAll('.build-pending').forEach(piece => piece.classList.remove('build-pending'));
    svg.removeAttribute('aria-busy');
    cursor.remove();
  }
  // Resolves true when the build ran to the end, false when it was interrupted.
  async function build(order, unit, onStep) {
    complete();
    abort = new AbortController();
    const built = new Set();
    const drawing = [];
    pieces.forEach(piece => piece.classList.add('build-pending'));
    svg.setAttribute('aria-busy', 'true');
    const [, , viewWidth] = svg.getAttribute('viewBox').split(' ').map(Number);
    at = { x: viewWidth / 2, y: 0 };
    svg.append(cursor);
    try {
      for (const index of order) {
        const node = nodes[index];
        onStep(built.size, node);
        const lane = laneOf(node);
        if (lane?.classList.contains('build-pending')) type(lane, unit * .5).catch(() => {});
        await buildNode(node, unit);
        built.add(index);
        edges.filter(edge => built.has(Number(edge.dataset.from)) && built.has(Number(edge.dataset.to)) && edge.classList.contains('build-pending'))
          .forEach(edge => {
            const drawn = drawEdge(edge, unit);
            drawn.catch(() => {});
            drawing.push(drawn);
          });
      }
      onStep(built.size, null);
      await Promise.all(drawing);
      await moveCursor(viewWidth + 20, at.y, unit * .4, 'ease-in');
      await wait(unit * .3);
      complete();
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') { complete(); throw error; }
      return false;
    }
  }
  return { build, complete };
}

document.querySelectorAll('.architecture').forEach(figure => {
  figure.querySelector('svg').setAttribute('role', 'group');
  const nodes = [...figure.querySelectorAll('[data-step]')];
  const panels = [...figure.querySelectorAll('[data-step-panel]')];
  const edges = [...figure.querySelectorAll('.diagram-edge')];
  const overview = figure.querySelector('.workflow-overview');
  const counter = figure.querySelector('.workflow-counter');
  const play = figure.querySelector('[data-workflow-play]');
  const speed = figure.querySelector('[data-workflow-speed]');
  const progress = figure.querySelector('.workflow-progress');
  const readout = figure.querySelector('.workflow-readout');
  const scenarios = JSON.parse(figure.dataset.scenarios || '[]');
  const scenarioSelect = figure.querySelector('[data-workflow-scenario]');
  let timeline = scenarios.length ? scenarios.find(route => route.id === scenarioSelect.value).groups : JSON.parse(figure.dataset.timeline || 'null') || nodes.map((_, i) => [i]);
  let cursor = -1;
  let selected = [];
  let active = -1;
  let timer;
  let playing = false;
  let completed = false;
  let building = null;
  // Auto-follow stops as soon as the visitor scrolls the popup themselves, until the next build or replay.
  let followPopup = true;
  const stopFollowing = () => { if (figure.closest('dialog[open]')) followPopup = false; };
  ['wheel', 'touchmove'].forEach(type => document.addEventListener(type, stopFollowing, { passive: true }));
  document.addEventListener('keydown', event => { if (['PageUp', 'PageDown'].includes(event.key)) stopFollowing(); });
  document.addEventListener('pointerdown', event => { if (event.target.matches('.project-dialog-scroll')) stopFollowing(); });
  const builder = createDiagramBuilder(figure.querySelector('svg'), nodes, edges);
  const rebuild = document.createElement('button');
  rebuild.type = 'button';
  rebuild.dataset.workflowRebuild = '';
  rebuild.textContent = 'Rebuild';
  rebuild.setAttribute('aria-label', 'Rebuild diagram from scratch');
  figure.querySelector('[data-workflow-replay]').after(rebuild);
  figure.querySelector('.workflow-toolbar').hidden = false;
  progress.hidden = false;

  // The canvas scrolls sideways on phones; vertically, only the popup scrolls.
  function revealInCanvas(node) {
    const behavior = motionIsPaused() ? 'instant' : 'smooth';
    const canvas = figure.querySelector('.diagram-canvas');
    const rect = node.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    const horizontal = rect.left < bounds.left || rect.right > bounds.right;
    const vertical = rect.top < bounds.top || rect.bottom > bounds.bottom;
    if (horizontal || (vertical && canvas.scrollHeight > canvas.clientHeight)) {
      canvas.scrollTo({ left: horizontal ? canvas.scrollLeft + rect.left - bounds.left - (canvas.clientWidth - rect.width) / 2 : canvas.scrollLeft, top: vertical ? canvas.scrollTop + rect.top - bounds.top - (canvas.clientHeight - rect.height) / 2 : canvas.scrollTop, behavior });
    }
    const scroller = figure.closest('.project-dialog-scroll');
    if (!scroller || !followPopup) return;
    const view = scroller.getBoundingClientRect();
    const top = view.top + 16;
    const bottom = view.bottom - 16;
    if (rect.top < top || rect.bottom > bottom) {
      scroller.scrollTo({ top: scroller.scrollTop + rect.top - top - Math.max(0, bottom - top - rect.height) / 2, behavior });
    }
  }
  function renderBuild() {
    counter.textContent = `BUILDING ${building.built} / ${nodes.length}`;
    play.textContent = 'Skip build';
    progress.setAttribute('aria-valuemax', String(nodes.length));
    progress.setAttribute('aria-valuenow', String(building.built));
    progress.firstElementChild.style.width = `${building.built / nodes.length * 100}%`;
  }
  function finishBuild() {
    if (!building) return;
    building = null;
    builder.complete();
    figure.classList.remove('is-building');
  }
  async function build() {
    clearTimeout(timer);
    finishBuild();
    if (motionIsPaused()) { selectStage(-1); return; }
    followPopup = true;
    playing = false;
    completed = false;
    selectStage(-1);
    // Build in walkthrough order so the diagram grows the way the work flows.
    const order = [...new Set([...timeline.flat(), ...nodes.keys()])];
    const run = building = { built: 0 };
    figure.classList.add('is-building');
    renderBuild();
    const unit = Math.min(950, Math.max(450, 9000 / nodes.length)) * Number(speed.value) / 2600;
    const finished = await builder.build(order, unit, (built, node) => {
      run.built = built;
      if (building !== run) return;
      renderBuild();
      if (node) revealInCanvas(node);
    });
    if (!finished || building !== run) return;
    finishBuild();
    start(true);
  }

  function render() {
    const visited = new Set((completed ? timeline : timeline.slice(0, Math.max(0, cursor))).flat());
    nodes.forEach((node, i) => {
      node.classList.toggle('is-selected', selected.includes(i));
      node.classList.toggle('is-completed', visited.has(i) && (completed || !selected.includes(i)));
      node.classList.toggle('is-skipped', scenarios.length > 0 && !timeline.some(group => group.includes(i)));
      node.setAttribute('aria-pressed', String(selected.includes(i)));
    });
    edges.forEach(edge => {
      const from = Number(edge.dataset.from);
      const to = Number(edge.dataset.to);
      const previous = cursor > 0 ? timeline[cursor - 1] : [];
      edge.classList.toggle('is-flowing', playing && selected.includes(to) && (previous.includes(from) || (edge.dataset.kind === 'context' && selected.includes(from)) || (edge.dataset.kind === 'feedback' && visited.has(from))));
      edge.classList.toggle('is-traversed', visited.has(from) && visited.has(to));
    });
    panels.forEach((panel, i) => { panel.hidden = !selected.includes(i); });
    overview.hidden = active !== -1;
    const fixStage = figure.dataset.project === 'bug-agent' && selected.some(i => i === 7 || i === 8);
    const afterGate = cursor > 0 && timeline[cursor - 1].includes(9);
    const phase = fixStage ? (afterGate ? 'IMPLEMENTATION' : 'FIX PROPOSAL') : playing ? 'PLAYING' : 'STAGE';
    counter.textContent = completed ? 'WALKTHROUGH COMPLETE' : active === -1 ? 'EXPLORE THE WORKFLOW' : cursor < 0 ? 'STAGE DETAIL' : `${phase} ${cursor + 1} / ${timeline.length}`;
    play.textContent = motionIsPaused() ? 'Motion paused' : playing ? 'Pause' : completed ? 'Play again' : 'Play walkthrough';
    play.disabled = motionIsPaused();
    play.title = motionIsPaused() ? 'Use the stage controls to explore while motion is paused.' : '';
    speed.disabled = motionIsPaused();
    rebuild.disabled = motionIsPaused();
    play.setAttribute('aria-pressed', String(playing));
    figure.classList.toggle('is-playing', playing);
    progress.setAttribute('aria-valuemax', String(timeline.length));
    progress.setAttribute('aria-valuenow', String(cursor + 1));
    progress.firstElementChild.style.width = `${(cursor + 1) / timeline.length * 100}%`;
    // Continuous playback is visual; manual exploration announces its explanation.
    readout.setAttribute('aria-live', playing ? 'off' : 'polite');
    if (active >= 0) revealInCanvas(nodes[active]);
    if (building) renderBuild();
  }
  function pause() {
    finishBuild();
    clearTimeout(timer);
    playing = false;
    render();
  }
  function selectStage(index) {
    if (index >= 0) finishBuild();
    clearTimeout(timer);
    playing = false;
    completed = false;
    active = index;
    selected = index < 0 ? [] : [index];
    cursor = index < 0 ? -1 : timeline.findIndex(group => group.includes(index));
    render();
  }
  function selectTimeline(index) {
    finishBuild();
    cursor = index;
    selected = timeline[cursor];
    active = selected[0];
    render();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.hidden || !figure.closest('dialog[open]') || motionIsPaused()) { pause(); return; }
      if (cursor === timeline.length - 1) {
        completed = true;
        playing = false;
        render();
        return;
      }
      selectTimeline(cursor + 1);
      schedule();
    }, Number(speed.value));
  }
  function start(restart = false) {
    // Reduced-motion visitors retain manual exploration without timed changes.
    if (motionIsPaused()) { selectStage(restart || active < 0 ? 0 : active); return; }
    if (restart || completed || cursor < 0) cursor = 0;
    followPopup = true;
    completed = false;
    playing = true;
    selectTimeline(cursor);
    schedule();
  }
  nodes.forEach((node, index) => {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-pressed', 'false');
    node.addEventListener('click', () => selectStage(index));
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); selectStage(index);
      } else if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + nodes.length) % nodes.length;
        nodes[next].focus(); selectStage(next);
      }
    });
  });
  play.addEventListener('click', () => {
    if (building) { finishBuild(); start(true); } else if (playing) pause(); else start();
  });
  figure.querySelector('[data-workflow-replay]').addEventListener('click', () => start(true));
  rebuild.addEventListener('click', build);
  figure.querySelector('[data-workflow-prev]').addEventListener('click', () => { followPopup = true; pause(); completed = false; selectTimeline(cursor <= 0 ? timeline.length - 1 : cursor - 1); });
  figure.querySelector('[data-workflow-next]').addEventListener('click', () => { followPopup = true; pause(); completed = false; selectTimeline((cursor + 1) % timeline.length); });
  figure.querySelector('[data-workflow-reset]').addEventListener('click', () => { finishBuild(); selectStage(-1); });
  speed.addEventListener('change', () => { if (playing) schedule(); });
  scenarioSelect?.addEventListener('change', () => {
    pause();
    timeline = scenarios.find(route => route.id === scenarioSelect.value).groups;
    selectStage(-1);
  });
  workflowPlayers.set(figure, { start, pause, build, reset: () => { finishBuild(); selectStage(-1); } });
});

// Native dialog supplies focus containment, Escape handling, and modal semantics.
if (typeof HTMLDialogElement !== 'undefined' && 'showModal' in HTMLDialogElement.prototype) {
  const dialog = document.createElement('dialog');
  dialog.className = 'project-dialog';
  dialog.id = 'project-dialog';
  dialog.setAttribute('aria-labelledby', 'project-dialog-title');
  dialog.setAttribute('aria-describedby', 'project-dialog-note');
  dialog.innerHTML = `<div class="project-dialog-header"><div><span class="eyebrow">INSIDE THE PROJECT</span><h2 id="project-dialog-title"></h2></div><button type="button" class="dialog-close" aria-label="Close project workflow" autofocus>×</button></div><div class="project-dialog-scroll"><p class="project-dialog-summary"></p><p id="project-dialog-note"><span class="playback-dot" aria-hidden="true"></span>Animated walkthrough · illustrative playback of the architecture</p><div class="project-dialog-content"></div></div>`;
  document.body.append(dialog);
  const content = dialog.querySelector('.project-dialog-content');
  const entries = new Map();
  let current;
  let returnFocus;

  function restoreCurrent() {
    if (!current) return;
    if (current.figure) workflowPlayers.get(current.figure).pause();
    current.card.insertBefore(current.expanded, current.anchor);
    current.card.classList.remove('is-open');
    current = null;
  }
  function openProject(entry, study = false) {
    const wasOpen = dialog.open;
    if (current !== entry) {
      restoreCurrent();
      current = entry;
      returnFocus = entry.button;
      content.append(entry.expanded);
      dialog.querySelector('h2').textContent = entry.title;
      dialog.querySelector('.project-dialog-summary').textContent = entry.summary;
      entry.card.classList.add('is-open');
      dialog.querySelector('#project-dialog-note').hidden = !entry.figure;
    }
    if (!wasOpen) dialog.showModal();
    document.documentElement.classList.add('project-modal-open');
    dialog.querySelector('.project-dialog-scroll').scrollTop = 0;
    // Projects whose workflow is still in progress open straight to their case study.
    if (!entry.figure) {
      entry.study.open = true;
      return;
    }
    const player = workflowPlayers.get(entry.figure);
    if (study) {
      player.pause();
      entry.study.open = true;
      requestAnimationFrame(() => entry.study.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    } else {
      entry.study.open = false;
      player.reset();
      if (!motionIsPaused()) player.build();
    }
  }
  document.querySelectorAll('.project-card').forEach(card => {
    const expanded = card.querySelector('.project-expanded');
    const button = card.querySelector('.project-open');
    if (!expanded || !button) return;
    const anchor = document.createComment('Project workflow returns here when popup closes.');
    expanded.after(anchor);
    const entry = { card, expanded, anchor, button, figure: expanded.querySelector('.architecture'), study: expanded.querySelector('.case-study'), title: card.querySelector('h3').textContent, summary: card.querySelector('.project-description').textContent };
    entries.set(card.id, entry);
    card.classList.add('popup-ready');
    if (!entry.figure) card.classList.add('workflow-draft');
    button.hidden = false;
    button.setAttribute('aria-controls', dialog.id);
    button.setAttribute('aria-label', entry.figure ? `Explore ${entry.title} workflow` : `Read ${entry.title} case study`);
    button.addEventListener('click', () => openProject(entry));
    card.addEventListener('click', event => {
      if (event.target.closest('a, button, summary, details, [role="button"]') || window.getSelection()?.toString()) return;
      openProject(entry);
    });
  });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], select:not([disabled]), summary, [tabindex="0"]')]
      .filter(element => element.getClientRects().length && !element.closest('[hidden]'));
    if (!focusable.length) return;
    event.preventDefault();
    const index = focusable.indexOf(document.activeElement);
    const next = (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    focusable[next].focus();
  });
  let pointerStartedOutside = false;
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => { pointerStartedOutside = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => {
    if (pointerStartedOutside && event.target === dialog && outside(event)) dialog.close();
    pointerStartedOutside = false;
  });
  dialog.addEventListener('close', () => {
    // Ignore a stale close event if another project was immediately opened.
    if (dialog.open) return;
    restoreCurrent();
    document.documentElement.classList.remove('project-modal-open');
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
  });
  function openLinkedStudy() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (id.endsWith('-study')) {
      const entry = entries.get(id.slice(0, -6));
      if (entry) openProject(entry, true);
    }
  }
  window.addEventListener('hashchange', openLinkedStudy);
  openLinkedStudy();
}

function pauseAllWorkflows() { workflowPlayers.forEach(player => player.pause()); }
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAllWorkflows(); });
workflowMotion.addEventListener('change', () => { if (motionIsPaused()) pauseAllWorkflows(); });
new MutationObserver(() => { if (motionIsPaused()) pauseAllWorkflows(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
