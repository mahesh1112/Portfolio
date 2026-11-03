const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = document.getElementById('motionToggle');
function setMotion(paused) {
  document.documentElement.classList.toggle('motion-paused', paused);
  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.textContent = paused ? 'Enable motion' : 'Pause motion';
}
setMotion(reducedMotion.matches);
motionToggle.addEventListener('click', () => setMotion(motionToggle.getAttribute('aria-pressed') !== 'true'));
reducedMotion.addEventListener('change', event => setMotion(event.matches));

const focusAreas = {
  models: ['01 / MODEL ADAPTATION', 'Smaller models. Greater possibilities.', 'Exploring fine-tuning, distillation, and quantization to balance model quality with efficiency.', '#finetuning'],
  rag: ['02 / RETRIEVAL', 'The right context changes everything.', 'Connecting documents and learning content with context-aware retrieval to make answers more useful.', '#learnwave-ai'],
  agents: ['03 / AGENTIC SYSTEMS', 'From recurring tasks to reliable workflows.', 'Building tool-using agents with human approvals, guardrails, and browser-assisted validation.', '#bug-agent'],
  evaluation: ['04 / EVALUATION', 'Good AI needs more than a good demo.', 'Measuring faithfulness, relevance, latency, and model quality with RAGAS, DeepEval, and experiment tracking.', '#skills']
};
document.querySelectorAll('[data-focus]').forEach(button => {
  button.addEventListener('click', () => {
    const [index, title, description, href] = focusAreas[button.dataset.focus];
    document.querySelectorAll('[data-focus]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
    document.getElementById('focusIndex').textContent = index;
    document.getElementById('focusTitle').textContent = title;
    document.getElementById('focusDescription').textContent = description;
    document.getElementById('focusLink').href = href;
  });
});

document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
// Content remains visible when JavaScript or IntersectionObserver is unavailable.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-heading, .project-card, .skill-card, .timeline-item, .about-layout, .contact-inner').forEach(element => {
    element.classList.add('reveal');
    observer.observe(element);
  });
}

const menu = document.getElementById('mobileMenu');
menu.setAttribute('aria-controls', 'navLinks');
const navLinks = document.getElementById('navLinks');
function closeMenu() {
  navLinks.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = '☰';
}
menu.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.textContent = open ? '×' : '☰';
});
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

const filterButtons = [...document.querySelectorAll('[data-filter]')];
const projectCards = [...document.querySelectorAll('.project-card[data-category]')];
function filterProjects(category) {
  filterButtons.forEach(button => {
    const selected = button.dataset.filter === category;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  let shown = 0;
  projectCards.forEach(card => {
    card.hidden = category !== 'All' && card.dataset.category !== category;
    if (!card.hidden) shown++;
  });
  document.getElementById('projectCount').textContent = String(shown).padStart(2, '0') + ' PROJECTS';
}
filterButtons.forEach(button => button.addEventListener('click', () => filterProjects(button.dataset.filter)));

// A project link must work even if a category filter previously hid its card.
function revealLinkedProject() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  const card = target?.closest('.project-card');
  if (card?.hidden) filterProjects('All');
  if (target?.matches('.case-study')) target.open = true;
  if (card) {
    card.classList.add('is-visible');
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
}
window.addEventListener('hashchange', revealLinkedProject);
revealLinkedProject();

document.querySelectorAll('.diagram-jump').forEach(link => link.addEventListener('click', () => {
  document.getElementById(link.hash.slice(1)).open = true;
}));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    menu.click();
    menu.focus();
  }
});
