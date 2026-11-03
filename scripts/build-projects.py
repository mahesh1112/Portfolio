"""Render static case studies from projects.json. Run after editing project content."""
from pathlib import Path
from html import escape
import json
import re

ROOT = Path(__file__).resolve().parent.parent

# Explanations of the documented stages, not simulated project execution.
STEPS = {
    'ai-engineering': ['The task specification supplies requirements and context for the engineering workflow.', 'LLMs use tools through MCP and AI Hooks, with pre-tool guardrails around execution.', 'The workflow generates backend or frontend code against the task specification.', 'Auditing, validation, and post-tool guardrails inspect the generated work.', 'GitHub and CI/CD connect the generated changes to the engineering delivery process.', 'Reported initiative outcomes cover 238 tasks and 1,875+ engineering hours saved. The measurement baseline is not yet documented here.'],
    'deeppulse': ['Knowledge sources enter the ingestion pipeline for preparation.', 'Embeddings represent the prepared knowledge for semantic retrieval.', 'PostgreSQL and pgvector store knowledge and its vector representations.', 'Employee data and organizational objectives supply the personalization context.', 'LangChain connects retrieval with context construction for generation.', 'The LLM uses employee context and retrieved knowledge to produce personalized feedback.'],
    'finetuning': ['The React interface configures model, dataset, and training parameters on a static GitHub Pages site.', 'This authenticated job bridge is a proposed design component connecting the UI to an active runtime.', 'The user must start and authorize the Colab notebook. The static website cannot assume an automatic cold start.', 'The target workflow validates the training configuration before execution.', 'Python training uses PyTorch, Transformers, and PEFT for LoRA or QLoRA adaptation.', 'The target workflow saves adapters, metrics, and logs outside the temporary runtime. A completed training benchmark is not claimed.'],
    'nichrome': ['The mobile experience provides business-card input for the extraction capability.', 'OCR and machine learning extract text from the card.', 'Selective LLM extraction supports structured business-card fields.', 'Product documents and videos provide a separate knowledge source for field teams.', 'Search and Q&A help field users access relevant product information.', 'The Flutter application gives field teams access to the mobile experience. The public repository covers the mobile app.'],
    'agentic-workflows': ['A GitHub Actions schedule triggers the recurring workflow.', 'Version-controlled workflow definitions describe the automation.', 'Python scripts run the recurring AI-summary task.', 'The workflow generates AI-related summary content.', 'Outputs are maintained in version control so changes can be traced.', 'Recurring runs maintain updated summaries. This is scheduled automation; a multi-agent execution system is not established by the description.']
}


def diagram(project, title):
    key = project['id']
    positions = project.get('positions', [(12, 36), (212, 36), (412, 36), (12, 172), (212, 172), (412, 172)])
    width = project.get('node_width', 172)
    steps = project.get('steps', STEPS.get(key, []))
    assert len(positions) == len(project['nodes']) == len(steps), f'Incomplete diagram: {key}'
    scenarios = project.get('scenarios', [])
    extra = f' data-scenarios="{escape(json.dumps(scenarios), quote=True)}" data-detailed="true"' if scenarios else ''
    if not scenarios and project.get('positions'):
        extra = ' data-detailed="true"'
    if project.get('timeline'):
        extra += f' data-timeline="{escape(json.dumps(project["timeline"]), quote=True)}"'
    extra += f' data-project="{escape(key)}"'
    description = project['caption'] + ' ' + '; '.join(' — '.join(n) for n in project['nodes'])
    parts = [f'''<figure class="architecture"{extra}>
      <div class="architecture-heading"><span>SYSTEM ARCHITECTURE</span><a href="#{key}-study" class="diagram-jump">Walkthrough ↓</a></div>
      <p class="diagram-mobile-hint">Swipe the diagram · select a stage to learn more</p>
      <div class="diagram-canvas" tabindex="0" role="region" aria-label="{escape(title)} workflow diagram, scroll horizontally on smaller screens">
      <svg viewBox="{project.get('viewbox', '0 0 596 260')}" role="img" aria-labelledby="{key}-diagram-title {key}-diagram-desc">
        <title id="{key}-diagram-title">{escape(title)} architecture</title><desc id="{key}-diagram-desc">{escape(description)}</desc>
        <defs><marker id="{key}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8ba4c8"/></marker></defs>''']
    labels = project.get('lane_labels', [[12, 18, project['lanes'][0]], [12, 154, project['lanes'][1]]])
    for x, y, label in labels:
        parts.append(f'<text x="{x}" y="{y}" class="diagram-lane">{escape(label)}</text>')
    for edge in project['edges']:
        a, b = (edge['from'], edge['to']) if isinstance(edge, dict) else edge
        x, y = positions[a]
        xx, yy = positions[b]
        path = edge['path'] if isinstance(edge, dict) else (f'M {x+width} {y+33} H {xx-7}' if y == yy else f'M {x+width-20} {y+66} V 122 H {xx+width-20} V {yy-6}')
        kind = edge.get('kind', 'flow') if isinstance(edge, dict) else 'flow'
        parts.append(f'<path d="{path}" class="diagram-edge" data-kind="{kind}" data-from="{a}" data-to="{b}" marker-end="url(#{key}-arrow)"/>')
        if isinstance(edge, dict) and edge.get('label'):
            parts.append(f'<text x="{edge["label_x"]}" y="{edge["label_y"]}" class="diagram-edge-label">{escape(edge["label"])}</text>')
    for i, ((x, y), (label, sub)) in enumerate(zip(positions, project['nodes'])):
        style = ' diagram-output' if i == project.get('output_node', len(project['nodes']) - 1) else ''
        if i in project.get('stores', []):
            style += ' diagram-store'
        parts.append(f'''<g class="diagram-node{style}" data-step="{i}" aria-label="Stage {i+1}: {escape(label)}"><rect x="{x}" y="{y}" width="{width}" height="66" rx="8"/><text x="{x+12}" y="{y+26}" class="diagram-label">{escape(label)}</text><text x="{x+12}" y="{y+46}" class="diagram-sub">{escape(sub)}</text></g>''')
    parts.append(f'</svg></div><figcaption>{escape(project["caption"])}</figcaption>')
    if scenarios:
        scenario_label = project.get('scenario_label', 'Explore a bug route')
        parts.append(f'<div class="workflow-scenarios"><label>{escape(scenario_label)}<select data-workflow-scenario aria-label="{escape(scenario_label)}">')
        for scenario in scenarios:
            selected = ' selected' if scenario['id'] == project.get('scenario_default', 'both') else ''
            parts.append(f'<option value="{scenario["id"]}"{selected}>{escape(scenario["label"])}</option>')
        note = project.get('scenario_note', 'Only the relevant agents run. For issues affecting both layers, both paths are highlighted together. Repeated fix stages show proposal first, then implementation after the PR-impact gate.')
        parts.append(f'</select></label><p>{escape(note)}</p>')
        if key == 'bug-agent':
            parts.append('<p class="workflow-route-note">Frontend quickfix is an available specialist; its invocation trigger is not yet specified.</p>')
        parts.append('</div>')
    parts.append('<div class="workflow-explorer"><div class="workflow-toolbar" hidden><span class="workflow-counter">EXPLORE THE WORKFLOW</span><div class="playback-controls"><button type="button" data-workflow-play aria-pressed="false">Play walkthrough</button><button type="button" data-workflow-replay aria-label="Replay walkthrough">Replay</button><label class="playback-speed">Speed <select data-workflow-speed aria-label="Walkthrough playback speed"><option value="5200">0.5×</option><option value="2600" selected>1×</option><option value="1300">2×</option></select></label><button type="button" data-workflow-prev aria-label="Previous workflow stage">←</button><button type="button" data-workflow-next aria-label="Next workflow stage">→</button><button type="button" data-workflow-reset>Overview</button></div></div><div class="workflow-progress" role="progressbar" aria-label="Walkthrough progress" aria-valuemin="0" aria-valuemax="6" aria-valuenow="0" hidden><span></span></div>')
    parts.append('<div class="workflow-readout" aria-live="polite" aria-atomic="true"><div class="workflow-overview"><strong>From input to outcome.</strong><p>Select a stage in the diagram to explore its role. Arrows show how information moves through the system.</p></div>')
    for i, ((label, _), explanation) in enumerate(zip(project['nodes'], steps)):
        parts.append(f'<div class="workflow-step" data-step-panel="{i}" hidden><strong>{i+1:02} / {escape(label)}</strong><p>{escape(explanation)}</p></div>')
    parts.append('</div></div></figure>')
    return '\n'.join(parts)


def pending():
    """Placeholder for a project whose workflow diagram is not yet published."""
    return ('<div class="workflow-pending" role="note" aria-label="Architecture in progress"><span class="pending-sketch" aria-hidden="true"><i></i><i></i><i></i></span>'
            '<span class="eyebrow">ARCHITECTURE IN PROGRESS</span><p>The detailed workflow for this project is still being documented and will appear here soon. '
            'The engineering case study below summarizes the work so far.</p></div><!-- /workflow-pending -->')


def main():
    target = ROOT / 'index.html'
    source = target.read_text(encoding='utf-8')
    data = json.loads((ROOT / 'projects.json').read_text(encoding='utf-8'))
    cards = {re.search(r' id="([^"]+)"', card)[1]: card for card in re.findall(r'<article class="project-card.*?</article>', source, re.S)}
    rendered = []
    for number, project in enumerate(data, 1):
        key = project['id']
        card = cards[key]
        # "workflow_status": "draft" keeps an unfinished diagram out of the published page.
        draft = project.get('workflow_status') == 'draft'
        # Remove prior generated wrappers and launch buttons before rebuilding.
        card = re.sub(r'<button[^>]*class="project-open".*?</button>', '', card, flags=re.S)
        card = card.replace('<div class="project-expanded">', '').replace('<!-- /project-expanded --></div>', '')
        title = project.get('title', re.search(r'<h3>(.*?)</h3>', card)[1])
        if 'title' in project:
            card = re.sub(r'<h3>.*?</h3>', lambda _: f'<h3>{escape(title)}</h3>', card, count=1)
        card = re.sub(r'<span class="project-number">.*?</span>', f'<span class="project-number">{number:02} / {len(data):02}</span>', card)
        card = re.sub(r'<p class="project-status">.*?</p>', '', card)
        card = card.replace('<div class="project-type">', f'<p class="project-status">{escape(project["status"])}</p><div class="project-type">', 1)
        # Replace either the original feature list or the already-rendered diagram.
        card = re.sub(r'<ul class="project-details">.*?</ul>|<figure class="architecture"[^>]*>.*?</figure>|<div class="workflow-pending".*?<!-- /workflow-pending -->', lambda _: pending() if draft else diagram(project, title), card, flags=re.S)
        if 'summary' in project:
            card = re.sub(r'<p class="project-description">.*?</p>', lambda _: f'<p class="project-description">{escape(project["summary"])}</p>', card, flags=re.S)
        if 'subtitle' in project:
            card = re.sub(r'<p class="project-subtitle">.*?</p>', lambda _: f'<p class="project-subtitle">{escape(project["subtitle"])}</p>', card, flags=re.S)
        if 'tags' in project:
            tags = ''.join(f'<span>{escape(tag)}</span>' for tag in project['tags'])
            card = re.sub(r'<div class="tag-row">.*?</div>', lambda _: f'<div class="tag-row">{tags}</div>', card, flags=re.S)
        if 'impact' in project:
            card = re.sub(r'<div class="impact-chip">.*?</div>', lambda _: f'<div class="impact-chip">{escape(project["impact"])}</div>', card, flags=re.S)
        card = re.sub(r'<details class="case-study".*?</details>', '', card, flags=re.S)
        body = f'<details class="case-study" id="{key}-study"><summary><span>Engineering case study</span><span class="study-indicator" aria-hidden="true">+</span></summary><div class="case-study-body">'
        for label, field in [('The problem', 'problem'), ('Contribution & scope', 'contribution'), ('Design rationale', 'decision'), ('Results & evidence', 'evidence'), ('Evaluation context', 'limit'), ('Next validation step', 'next')]:
            body += f'<section class="study-section"><h4>{escape(label)}</h4><p>{escape(project[field])}</p></section>'
        for section in project.get('study_sections', []):
            body += f'<section class="study-section"><h4>{escape(section["label"])}</h4><p>{escape(section["text"])}</p></section>'
        body += '</div></details>'
        card = card.replace('<div class="tag-row">', body + '<div class="tag-row">', 1)
        anchor = '<div class="workflow-pending"' if draft else '<figure class="architecture"'
        label = 'Read case study' if draft else 'Explore workflow'
        card = card.replace(anchor, f'<button type="button" class="project-open" aria-haspopup="dialog" hidden>{label} <span aria-hidden="true">↗</span></button><div class="project-expanded">{anchor}', 1)
        card = card.replace('</details>', '</details><!-- /project-expanded --></div>', 1)
        rendered.append(card)
    start = source.index('      <div class="project-grid"')
    end = source.index('      <div class="github-callout">', start)
    source = source[:start] + '      <div class="project-grid" id="projectGrid">\n' + '\n\n'.join(rendered) + '\n      </div>\n' + source[end:]
    target.write_text(source, encoding='utf-8')
    drafts = sum(project.get('workflow_status') == 'draft' for project in data)
    print(f'Rendered {len(rendered) - drafts} architectures, {drafts} in-progress placeholders, and {len(rendered)} case studies.')


if __name__ == '__main__':
    main()
