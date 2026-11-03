// Dependency-free browser smoke checks using a locally installed Chrome/Edge.
// Run: node scripts/verify-portfolio.mjs [absolute-path-to-chromium]
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'portfolio-qa-'));
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(resolve(root) + '\\') && !path.startsWith(resolve(root) + '/')) throw Error('Invalid path');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.pdf': 'application/pdf' })[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let browserLog = '';
browser.stderr.on('data', data => { browserLog += data; });
browser.on('error', error => { browserLog += error.message; });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(200); }
  }
  if (!port) throw Error('Browser did not start: ' + browserLog.slice(-1800));
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => { pending.delete(callId); reject(Error('CDP timeout: ' + method)); }, 15000);
    pending.set(callId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const check = (value, message) => { if (!value) throw Error(message); console.log('PASS ' + message); };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate('document.querySelectorAll(".diagram-node[role=button]").length === 53')) break;
    await delay(100);
  }
  check(await evaluate('document.querySelectorAll(".diagram-node[role=button]").length === 103'), 'Nine published interactive diagrams / 103 explorable stages');
  check(await evaluate(`!document.querySelector('.project-card.workflow-draft, .workflow-pending') && [...document.querySelectorAll('.project-open')].every(button => button.textContent.startsWith('Explore workflow'))`), 'Every project publishes its workflow');
  check(await evaluate(`!document.querySelector('.project-repo-link, .project-card a[href*="github.com"]')`), 'Project cards carry no repository links');
  check(await evaluate(`[...document.querySelectorAll('.project-card')].map(card => card.id).join() === 'ai-engineering,bug-agent,learnwave-ai,deeppulse,nichrome,hireflow,face-recognition,finetuning,agentic-workflows'`), 'Projects are ordered by impact');
  check(await evaluate(`(async () => {
    for (const button of document.querySelectorAll('.project-card:not(.workflow-draft) .project-open')) {
      const card = button.closest('.project-card');
      const figure = card.querySelector('.architecture');
      button.click();
      const dialog = document.querySelector('.project-dialog');
      if (!dialog.open || !dialog.contains(figure) || dialog.querySelector('h2').textContent !== card.querySelector('h3').textContent) return false;
      const nodes = [...figure.querySelectorAll('[data-step]')];
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        if (nodes[i].getAttribute('aria-pressed') !== 'true' || figure.querySelectorAll('.workflow-step:not([hidden])').length !== 1 || figure.querySelector('.workflow-step:not([hidden])').dataset.stepPanel !== String(i)) return false;
      }
      figure.querySelector('[data-workflow-reset]').click();
      figure.querySelector('[data-workflow-next]').click();
      if (nodes[0].getAttribute('aria-pressed') !== 'true') return false;
      figure.querySelector('[data-workflow-prev]').click();
      const selectedRoute = figure.querySelector('[data-workflow-scenario]')?.value;
      const last = figure.dataset.scenarios ? JSON.parse(figure.dataset.scenarios).find(route => route.id === selectedRoute).groups.at(-1) : figure.dataset.timeline ? JSON.parse(figure.dataset.timeline).at(-1) : [nodes.length - 1];
      if (!last.every(index => nodes[index].getAttribute('aria-pressed') === 'true')) return false;
      figure.querySelector('[data-workflow-reset]').click();
      if (figure.querySelector('.workflow-overview').hidden) return false;
      dialog.close();
      await new Promise(resolve => setTimeout(resolve, 30));
      if (!card.contains(figure)) return false;
    }
    return true;
  })()`), 'All published workflow popups, stage controls, overview reset, and content restoration');
  check(await evaluate(`(async () => {
    document.querySelector('#bug-agent .project-open').click();
    const figure = document.querySelector('.project-dialog .architecture');
    const selector = figure.querySelector('[data-workflow-scenario]');
    if (!selector || figure.querySelectorAll('[data-step]').length !== 18) return false;
    const scenarios = JSON.parse(figure.dataset.scenarios);
    for (const scenario of scenarios) {
      selector.value = scenario.id;
      selector.dispatchEvent(new Event('change'));
      const visited = [];
      const phases = [];
      for (let i = 0; i < scenario.groups.length; i++) {
        figure.querySelector('[data-workflow-next]').click();
        visited.push([...figure.querySelectorAll('.diagram-node[aria-pressed=true]')].map(node => Number(node.dataset.step)));
        phases.push(figure.querySelector('.workflow-counter').textContent);
      }
      const flat = visited.flat();
      if (scenario.id.startsWith('frontend') && [6,8,11].some(id => flat.includes(id))) return false;
      if (scenario.id.startsWith('backend') && [5,7,10].some(id => flat.includes(id))) return false;
      if (scenario.id.startsWith('both') && !visited.some(group => group.includes(5) && group.includes(6))) return false;
      if (!visited.some(group => group.includes(2) && group.includes(3))) return false;
      if (flat.includes(12) || flat.at(-1) !== 17) return false;
      const gate = visited.findIndex(group => group.includes(9));
      if (!phases[gate-1].startsWith('FIX PROPOSAL') || !phases[gate+1].startsWith('IMPLEMENTATION')) return false;
      if (scenario.id.endsWith('-retry')) {
        const review = flat.indexOf(14), retry = flat.indexOf(15), retro = flat.indexOf(16);
        if (!(review < retry && retry < retro && flat.lastIndexOf(13) < retro && retro < flat.lastIndexOf(14))) return false;
      } else if (flat.includes(15) || flat.includes(16)) return false;
    }
    document.querySelector('.project-dialog').close();
    await new Promise(resolve => setTimeout(resolve, 40));
    return true;
  })()`), 'Bug agent: six conditional routes, parallel lanes, KB context, proposal/impact/implementation gate, developer feedback and retrospective');
  check(await evaluate(`(async () => {
    document.querySelector('#learnwave-ai .project-open').click();
    const figure = document.querySelector('.project-dialog .architecture');
    if (document.querySelector('.project-dialog h2').textContent !== 'Learnware AI' || figure.querySelectorAll('.diagram-store').length !== 3) return false;
    figure.querySelector('[data-workflow-reset]').click();
    const groups = [];
    const count = JSON.parse(figure.dataset.timeline).length;
    for (let i = 0; i < count; i++) {
      figure.querySelector('[data-workflow-next]').click();
      groups.push([...figure.querySelectorAll('.diagram-node[aria-pressed=true]')].map(node => Number(node.dataset.step)));
    }
    const flat = groups.flat();
    if (!(flat.indexOf(1) < flat.indexOf(2) && flat.indexOf(2) < flat.indexOf(3) && flat.indexOf(3) < flat.indexOf(4))) return false;
    if (!(flat.indexOf(8) < flat.indexOf(9) && flat.indexOf(9) < flat.indexOf(10) && flat.indexOf(10) < flat.indexOf(12))) return false;
    if (!groups.some(group => group.includes(6) && group.includes(7)) || !groups.some(group => group.includes(11) && group.includes(12))) return false;
    if (flat.at(-2) !== 14 || flat.at(-1) !== 6 || !figure.querySelector('.diagram-edge[data-from="14"][data-to="6"][data-kind="feedback"]')) return false;
    const text = figure.textContent;
    if (!text.includes('alt text') || !text.includes('reference location') || !text.includes('JEV')) return false;
    document.querySelector('.project-dialog').close();
    await new Promise(resolve => setTimeout(resolve, 40));
    return true;
  })()`), 'Learnware AI: three stores, image enrichment, JEV before RAG, prompt packaging, template selection, and completion feedback');
  check(await evaluate(`(async () => {
    document.querySelector('#hireflow .project-open').click();
    const figure = document.querySelector('.project-dialog .architecture');
    const selector = figure.querySelector('[data-workflow-scenario]');
    const scenarios = JSON.parse(figure.dataset.scenarios);
    if (scenarios.length !== 6 || figure.querySelectorAll('[data-step]').length !== 20) return false;
    for (const route of scenarios) {
      selector.value = route.id;
      selector.dispatchEvent(new Event('change'));
      const visited = [];
      for (let i = 0; i < route.groups.length; i++) {
        figure.querySelector('[data-workflow-next]').click();
        visited.push(...[...figure.querySelectorAll('.diagram-node[aria-pressed=true]')].map(node => Number(node.dataset.step)));
        if (/FIX PROPOSAL|IMPLEMENTATION/.test(figure.querySelector('.workflow-counter').textContent)) return false;
      }
      if (route.id === 'upload') {
        if (!visited.includes(6) || !visited.includes(7) || visited.includes(8) || visited.includes(12) || visited.at(-1) !== 3) return false;
      } else {
        if (!(visited.indexOf(8) < visited.indexOf(9) && visited.indexOf(9) < visited.indexOf(10) && visited.indexOf(11) < visited.indexOf(12)) || visited.at(-1) !== 16) return false;
      }
      if (route.id === 'knockout' && (!visited.includes(17) || visited.includes(13) || visited.includes(14))) return false;
      if (route.id === 'search-fallback' && !(visited.indexOf(10) < visited.indexOf(18) && visited.indexOf(18) < visited.indexOf(11))) return false;
      if (route.id === 'score-fallback' && !(visited.indexOf(13) < visited.indexOf(19) && visited.indexOf(19) < visited.indexOf(14))) return false;
      if (route.id === 'screen' && !(visited.indexOf(12) < visited.indexOf(13) && visited.indexOf(13) < visited.indexOf(14))) return false;
    }
    selector.value = 'full'; selector.dispatchEvent(new Event('change'));
    const text = figure.textContent;
    if (!text.includes('384') || !text.includes('50%/50%') || !text.includes('40%') || !text.includes('does not perform text chunking')) return false;
    document.querySelector('.project-dialog').close();
    await new Promise(resolve => setTimeout(resolve, 40));
    return true;
  })()`), 'HireFlow: ingestion, screening, knockout bypass, SQL search fallback, deterministic scoring fallback, and separate retrieval/fit weights');
  check(await evaluate(`(async () => {
    document.querySelector('#face-recognition .project-open').click();
    const figure = document.querySelector('.project-dialog .architecture');
    const selector = figure.querySelector('[data-workflow-scenario]');
    const scenarios = JSON.parse(figure.dataset.scenarios);
    if (scenarios.length !== 6 || figure.querySelectorAll('[data-step]').length !== 20) return false;
    for (const route of scenarios) {
      selector.value = route.id;
      selector.dispatchEvent(new Event('change'));
      const visited = [];
      for (let i = 0; i < route.groups.length; i++) {
        figure.querySelector('[data-workflow-next]').click();
        visited.push(...[...figure.querySelectorAll('.diagram-node[aria-pressed=true]')].map(node => Number(node.dataset.step)));
      }
      const matched = visited.indexOf(7) < visited.indexOf(8) && visited.indexOf(8) < visited.indexOf(9) && visited.indexOf(9) < visited.indexOf(10) && visited.indexOf(10) < visited.indexOf(11);
      if (['verify', 'repeat', 'no-match', 'identify'].includes(route.id) && !matched) return false;
      if (route.id === 'verify' && (!visited.includes(5) || visited.includes(6) || visited.at(-1) !== 18)) return false;
      if (route.id === 'repeat' && (visited.includes(18) || visited.at(-1) !== 16)) return false;
      if (route.id === 'no-match' && (visited.includes(13) || visited.at(-1) !== 7)) return false;
      if (route.id === 'identify' && (!visited.includes(6) || visited.includes(5) || visited.includes(15) || visited.at(-1) !== 17)) return false;
      if (route.id === 'register' && (visited.includes(7) || visited.at(-1) !== 2)) return false;
    }
    if (!figure.querySelector('.diagram-edge[data-from="12"][data-to="7"][data-kind="feedback"]')) return false;
    selector.value = 'verify'; selector.dispatchEvent(new Event('change'));
    const text = figure.textContent;
    if (!text.includes('128-dimensional') || !text.includes('Euclidean distance') || !text.includes('0.6')) return false;
    document.querySelector('.project-dialog').close();
    await new Promise(resolve => setTimeout(resolve, 40));
    return true;
  })()`), 'Face recognition: 1:1 verification, 1:N identification, distance tolerance, no-match loop, duplicate check, registration, and review');
  await evaluate(`document.querySelector('#learnwave-ai h3').click()`);
  check(await evaluate(`document.querySelector('.project-dialog').open && document.querySelector('.project-dialog .is-building') !== null && document.querySelector('.project-dialog .build-cursor') !== null`), 'Card body click opens popup and starts building the diagram live');
  await evaluate(`(() => { const figure = document.querySelector('.project-dialog .architecture'); figure.querySelector('[data-workflow-speed]').value = '1300'; figure.querySelector('[data-workflow-speed]').dispatchEvent(new Event('change')); figure.querySelector('[data-workflow-play]').click(); window.qaText = [...figure.querySelectorAll('svg text')].map(text => text.textContent).join('|'); figure.querySelector('[data-workflow-rebuild]').click(); })()`);
  check(await evaluate(`(async () => {
    const figure = document.querySelector('.project-dialog .architecture');
    const original = window.qaText;
    for (let i = 0; i < 100 && !figure.classList.contains('is-playing'); i++) await new Promise(resolve => setTimeout(resolve, 100));
    const edges = [...figure.querySelectorAll('.diagram-edge')];
    return figure.classList.contains('is-playing') && !figure.querySelector('.build-pending, .build-cursor') && edges.every(edge => edge.getAttribute('marker-end') && !edge.style.strokeDasharray)
      && [...figure.querySelectorAll('svg text')].map(text => text.textContent).join('|') === original;
  })()`), 'Diagram build completes, restores the full diagram, and hands off to the walkthrough');
  await evaluate(`(() => { const figure = document.querySelector('.project-dialog .architecture'); figure.querySelector('[data-workflow-rebuild]').click(); figure.querySelector('[data-workflow-play]').click(); })()`);
  check(await evaluate(`(() => { const figure = document.querySelector('.project-dialog .architecture'); return figure.classList.contains('is-playing') && !figure.querySelector('.build-pending, .build-cursor') && figure.querySelector('[data-step="0"]').getAttribute('aria-pressed') === 'true'; })()`), 'Skip build reveals the full diagram and starts the walkthrough');
  await delay(1500);
  check(await evaluate(`document.querySelector('.project-dialog [data-step="1"]').getAttribute('aria-pressed') === 'true' && document.querySelector('.project-dialog .diagram-edge.is-flowing') !== null`), 'Timed playback advances stages and animates connecting edges');
  await evaluate(`document.querySelector('.project-dialog [data-workflow-play]').click()`);
  await delay(1500);
  check(await evaluate(`document.querySelector('.project-dialog [data-step="1"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('.project-dialog .is-playing')`), 'Pause holds the current stage');
  await evaluate(`document.querySelector('.project-dialog [data-workflow-replay]').click()`);
  check(await evaluate(`document.querySelector('.project-dialog [data-step="0"]').getAttribute('aria-pressed') === 'true'`), 'Replay starts from the first stage');
  await evaluate(`document.querySelector('.project-dialog [data-step="14"]').dispatchEvent(new MouseEvent('click', {bubbles:true})); document.querySelector('.project-dialog [data-workflow-play]').click()`);
  await delay(3200);
  check(await evaluate(`document.querySelector('.project-dialog .workflow-counter').textContent === 'WALKTHROUGH COMPLETE' && document.querySelectorAll('.project-dialog .diagram-node.is-completed').length === 15 && !document.querySelector('.project-dialog .is-playing')`), 'Playback completes and stops with all stages marked complete');
  await evaluate(`document.querySelector('.project-dialog [data-step="0"]').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' });
  check(await evaluate(`document.activeElement.dataset.step === '1' && document.activeElement.getAttribute('aria-pressed') === 'true'`), 'Keyboard navigation selects and focuses workflow stages');
  let focusContained = true;
  for (let i = 0; i < 24; i++) {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    if (!await evaluate(`!!document.activeElement.closest('.project-dialog')`)) focusContained = false;
  }
  check(focusContained, 'Modal contains keyboard focus through a full Tab cycle');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await delay(100);
  const closeState = await evaluate(`({ open: document.querySelector('.project-dialog').open, focus: document.activeElement.className, playing: !!document.querySelector('.is-playing'), locked: document.documentElement.classList.contains('project-modal-open') })`);
  check(!closeState.open && closeState.focus.includes('project-open') && !closeState.playing && !closeState.locked, 'Escape closes popup, stops playback, restores focus and page scrolling: ' + JSON.stringify(closeState));
  check(await evaluate(`(() => {
    const expected = { 'All': 9, 'Fine-Tuning': 1, 'RAG & LLMs': 4, 'Agents & Applied ML': 4 };
    for (const button of document.querySelectorAll('[data-filter]')) {
      button.click();
      if (document.querySelectorAll('.project-card:not([hidden])').length !== expected[button.dataset.filter]) return false;
    }
    return true;
  })()`), 'All project category filters');
  await evaluate(`document.querySelector('[data-filter="Fine-Tuning"]').click(); location.hash = '#learnwave-ai';`);
  await delay(150);
  check(await evaluate(`!document.getElementById('learnwave-ai').hidden`), 'Direct project links reveal filtered-out projects');
  await evaluate(`document.querySelector('#hireflow .diagram-jump').click()`);
  await delay(150);
  check(await evaluate(`document.getElementById('hireflow-study').open`), 'Walkthrough link opens the correct case study');
  check(await evaluate(`document.querySelector('.project-dialog').open && document.querySelector('.project-dialog h2').textContent === 'HireFlow'`), 'Direct case-study link opens the corresponding popup');
  check(await evaluate(`(() => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    return ids.length === new Set(ids).size && [...document.querySelectorAll('a[href^="#"]')].every(a => document.getElementById(a.hash.slice(1)));
  })()`), 'Unique IDs and valid internal links');
  for (const width of [1440, 1024, 768, 390, 360]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 650 });
    await delay(120);
    check(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `No horizontal page overflow at ${width}px`);
    check(await evaluate(`(() => { const dialog = document.querySelector('.project-dialog'); return dialog.scrollWidth <= dialog.clientWidth && dialog.getBoundingClientRect().width <= innerWidth && dialog.getBoundingClientRect().height <= innerHeight; })()`), `Popup fits the viewport at ${width}px`);
    check(await evaluate(`(() => {
      for (const text of document.querySelectorAll('.diagram-label, .diagram-sub')) {
        if (text.getBBox().width > Number(text.parentElement.querySelector('rect').getAttribute('width')) - 24) return false;
      }
      return true;
    })()`), `Diagram labels fit their nodes at ${width}px`);
  }
  await evaluate(`document.querySelector('.dialog-close').click()`);
  await delay(50);
  await evaluate(`document.getElementById('mobileMenu').click()`);
  check(await evaluate(`document.getElementById('mobileMenu').getAttribute('aria-expanded') === 'true'`), 'Mobile navigation opens');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  check(await evaluate(`document.getElementById('mobileMenu').getAttribute('aria-expanded') === 'false'`), 'Escape closes mobile navigation');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await evaluate(`document.documentElement.classList.contains('motion-paused')`)) break;
    await delay(100);
  }
  check(await evaluate(`document.documentElement.classList.contains('motion-paused')`), 'Reduced-motion preference respected');
  await evaluate(`document.querySelector('[data-filter="All"]').click(); location.hash = '#work';`);
  await delay(100);
  await evaluate(`document.querySelector('.project-card:not(.workflow-draft) .project-open').click()`);
  check(await evaluate(`!document.querySelector('.project-dialog .is-playing') && document.querySelector('.project-dialog .workflow-overview').hidden === false`), 'Reduced-motion popup opens without autoplay');
  await evaluate(`document.querySelector('.project-dialog [data-workflow-next]').click()`);
  check(await evaluate(`document.querySelector('.project-dialog [data-step="0"]').getAttribute('aria-pressed') === 'true'`), 'Manual workflow exploration works with reduced motion');
  const mobileScreenshot = join(tmpdir(), 'portfolio-mobile.png');
  await writeFile(mobileScreenshot, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate(`document.getElementById('work').scrollIntoView()`);
  await delay(100);
  const desktopScreenshot = join(tmpdir(), 'portfolio-desktop.png');
  await writeFile(desktopScreenshot, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('.project-dialog').close()`);
  await delay(50);
  await evaluate(`document.querySelector('#bug-agent .project-open').click(); const selector = document.querySelector('.project-dialog [data-workflow-scenario]'); selector.value = 'both-retry'; selector.dispatchEvent(new Event('change')); for (let i = 0; i < 5; i++) document.querySelector('.project-dialog [data-workflow-next]').click();`);
  const bugScreenshot = join(tmpdir(), 'portfolio-bug-agent.png');
  await writeFile(bugScreenshot, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  check(await evaluate(`(() => {
    const dialog = document.querySelector('.project-dialog');
    const canvas = dialog.querySelector('.diagram-canvas');
    return dialog.scrollWidth <= dialog.clientWidth && dialog.getBoundingClientRect().width <= innerWidth && canvas.scrollWidth > canvas.clientWidth && dialog.querySelectorAll('.diagram-node[aria-pressed=true]').length === 2;
  })()`), 'Detailed bug-agent diagram supports mobile scrolling and both affected layers');
  await evaluate(`document.querySelector('.project-dialog').close()`);
  await delay(50);
  await evaluate(`document.querySelector('#learnwave-ai .project-open').click(); document.querySelector('.project-dialog [data-workflow-reset]').click(); for (let i = 0; i < 8; i++) document.querySelector('.project-dialog [data-workflow-next]').click();`);
  check(await evaluate(`(() => {
    const dialog = document.querySelector('.project-dialog');
    const canvas = dialog.querySelector('.diagram-canvas');
    return dialog.scrollWidth <= dialog.clientWidth && canvas.scrollWidth > canvas.clientWidth && dialog.querySelector('[data-step="8"]').getAttribute('aria-pressed') === 'true';
  })()`), 'Learnware AI diagram and JEV stage work on mobile');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await delay(150);
  const learningScreenshot = join(tmpdir(), 'portfolio-learnware.png');
  await writeFile(learningScreenshot, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('.project-dialog').close()`);
  await delay(50);
  await evaluate(`(() => { document.querySelector('#hireflow .project-open').click(); const selector = document.querySelector('.project-dialog [data-workflow-scenario]'); selector.value = 'screen'; selector.dispatchEvent(new Event('change')); for (let i = 0; i < 7; i++) document.querySelector('.project-dialog [data-workflow-next]').click(); })()`);
  const hireflowScreenshot = join(tmpdir(), 'portfolio-hireflow.png');
  await writeFile(hireflowScreenshot, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  check(await evaluate(`(() => {
    const dialog = document.querySelector('.project-dialog');
    const canvas = dialog.querySelector('.diagram-canvas');
    return dialog.scrollWidth <= dialog.clientWidth && canvas.scrollWidth > canvas.clientWidth && dialog.querySelector('[data-step="12"]').getAttribute('aria-pressed') === 'true';
  })()`), 'HireFlow eligibility-gate diagram and scenario controls fit mobile');
  await cdp('Emulation.setScriptExecutionDisabled', { value: true });
  await cdp('Page.navigate', { url });
  await delay(500);
  const noJs = await cdp('DOM.getDocument');
  const html = (await cdp('DOM.getOuterHTML', { nodeId: noJs.root.nodeId })).outerHTML;
  check((html.match(/class="architecture"/g) || []).length === 9 && !html.includes('class="workflow-pending"') && (html.match(/class="case-study"/g) || []).length === 9 && !html.includes('class="project-card featured reveal"'), 'Static diagrams and native case studies available without JavaScript');
  check(errors.length === 0, 'No browser JavaScript errors');
  console.log(JSON.stringify({ url, desktopScreenshot, mobileScreenshot }));
} finally {
  socket?.close();
  browser.kill();
  await new Promise(resolve => server.close(resolve));
  await delay(300);
  try { await rm(profile, { recursive: true, force: true }); } catch { /* Browser may still be releasing its temporary profile. */ }
}
