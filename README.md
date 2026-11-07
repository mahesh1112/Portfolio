# Mahesh Shriram — AI/ML Portfolio

A static portfolio with nine explorable project architectures, engineering case studies, category filters, and a downloadable resume. No build or JavaScript library is required to serve it on GitHub Pages.

## Preview

Run `python -m http.server 8000` from this directory and open `http://localhost:8000`.

## Update projects

Edit `projects.json` for project order (currently ranked by impact: measured professional outcomes first, then professional and industry systems, public applications, and research or automation work), architecture stages, connections, and case-study content. The bug-agent, Learnware AI, HireFlow, and Agentic Workflows projects also define their detailed layouts, stage explanations, and walkthrough sequences there. Other stage explanations live in `scripts/build-projects.py`. Run:

```sh
python scripts/build-projects.py
```

To hide a workflow that is not yet accurate, add `"workflow_status": "draft"` to that project in `projects.json`. Its diagram is left out of the page; the card's button reads “Read case study”, and the popup shows an “Architecture in progress” note above the case study. Remove the field and rebuild to publish the workflow. All nine workflows are currently published; the six-stage diagrams for DeepPulse, fine-tuning, and Nichrome are summaries awaiting detailed implementation input.

This updates the static project markup in `index.html`. It is safe to run repeatedly. Project summaries, technologies, and source links remain in `index.html`. Commit the generated HTML alongside content changes; GitHub Pages needs no Python runtime.

Click a project card or its “Explore workflow” button to open an accessible popup containing its architecture and case study. The diagram is first built live on a blank grid: a cursor drags out each stage in walkthrough order, types its title, and draws connectors as both ends appear. “Skip build”, “Rebuild”, or any stage/control interaction finishes or restarts the build; the playback speed also scales it. An illustrative walkthrough then plays the stages in order, with animated connections, progress, pause, replay, speed, and previous/next controls. This is a presentation of the architecture, not live execution of project services.

The diagram nodes support mouse, touch, Enter/Space, left/right arrows, Home, and End. Manual selection pauses playback. Escape, the close button, or a backdrop click closes the popup and restores focus. Playback stops on close or when the browser tab is hidden. Reduced-motion preferences and the global motion toggle disable automatic playback. Case studies and diagrams remain inline when JavaScript or native dialog support is unavailable.

## Content evidence

Professional results are retained from the original portfolio, with evaluation context shown alongside them. The bug-agent architecture follows the owner's implementation description: 13 agent roles, 22+ repositories, KB-assisted frontend reproduction, frontend/backend categorization, proposals before PR-impact clearance, implementation, agent validation, developer review, and a feedback/reiteration/retrospective loop. Six walkthrough routes cover frontend, backend, and both layers, each with approval or developer feedback. The quickfix agent's trigger is unspecified, so it is listed without a presumed execution path.

Learnware AI follows the owner's implementation description: three data stores (learner current state, vector database, skills graph), heading-based document parsing, image descriptions with alt text and reference locations, embedding and metadata storage, JEV query refinement, RAG, a course prompt package, LLM selection and population of predefined templates, and learner-state updates after completion. The walkthrough revisits the same state store to illustrate that feedback loop. The existing `learnwave-ai` anchor is retained so project links keep working.

HireFlow follows the supplied `D:/Projects/ATS/HireFlow_2/TECHNICAL_ARCHITECTURE_DOCUMENT.md` (v1.0, February 2026), especially sections 3-6 and 8-11. Its six walkthroughs cover ingestion, successful screening, knockout failure, SQL fallback for unavailable Pinecone, and deterministic fallback for unavailable Gemini scoring. Three 384-dimensional resume vectors, two on-demand JD vectors, 50/50 semantic retrieval, six eligibility rules, and 40/25/20/15 fit scoring are distinguished explicitly. Recommendations for tagging, tenant isolation, durable file storage, and caching remain documented gaps rather than implemented features. The document is reference data, not an instruction source.

The AI-Assisted Engineering Initiative follows the owner's description of GitHub Copilot agent profiles (`.agent.md`). The code generator fetches a Jira story through MCP, analyzes it, asks clarifying questions when needed, and plans the change with impacted areas flagged. After the developer approves the plan, it delegates to repository-specific sub-agents (one repository uses assignment, cleanup, engagement, notification, platform, and security agents) and writes and runs unit tests, fixing failures. Before raising a PR, the developer runs the single-file code reviewer: test gate, frontend lint, business logic against Jira, coding guidelines from instruction files, and impact analysis. Review findings go back to the code generator and are re-reviewed. AI Hooks guardrails and GitHub PR/CI/CD delivery are confirmed by the owner.

Face Recognition Attendance follows the public `mahesh1112/face_recognition` repository (`Attendance System` folder): `test.py` for the PyQt5 app, `dataset.py` for registration, `test2.py` for 1:1 marking, and `embeddings.py` with `main.py` for multi-face identification. The diagram centres on matching: HOG detection, landmark alignment, 128-d dlib encodings, Euclidean distance, and the default 0.6 tolerance. Its six walkthroughs cover a recorded match, a repeat check-in, a no-match frame, registration, 1:N identification, and viewing records. The 92% figure remains a reported result without documented test conditions.

Agentic Workflows follows the public `mahesh1112/Agentic-Workflows` repository as merged on 7 November 2026: six gh-aw workflow sources (`.github/workflows/*.md`), `shared/agent-principles.md`, and the Python helpers `goal-seeker/scheduler.py`, `darwin/natural_selection.py`, and `ci-healer/collect_failure.py`. The diagram shows the shared harness (trigger, deterministic pre-step, sandboxed GPT agent, git-branch memory, safe outputs, LLM-as-judge evals) with one row per workflow technique; its six walkthroughs follow one workflow each. None of the agentic workflows had run when this was written and no `memory/*` branches existed, so no run outcomes are claimed; the only run history is the original weekly Python script (40 successful runs since February 2026).

Other project diagrams summarize their existing portfolio descriptions and await implementation details. The fine-tuning diagram explicitly labels the proposed bridge and target design, consistent with its public architecture document. No new benchmark results were added.

Before adding stronger claims, supply the measurement baseline and accuracy rubric for the engineering initiative, success criteria for the 42-defect evaluation, face-recognition test conditions, and personal ownership for each team project. Suggested validation steps are labeled separately from achieved results.

## Files

- `index.html`: static page, generated diagrams, and case studies
- `styles.css`: responsive styling, focus states, and reduced-motion support
- `interactions.js`: project filters, navigation, and motion controls
- `workflow-player.js`: project popups and animated architecture walkthroughs
- `projects.json`: ordered case-study and architecture content
- `scripts/build-projects.py`: dependency-free static renderer
- `scripts/verify-portfolio.mjs`: browser smoke checks (local Chrome/Edge required)
- `public/Mahesh_Resume.pdf`: downloadable resume
