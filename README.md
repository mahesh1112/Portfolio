# Mahesh Shriram — AI/ML Portfolio

A static portfolio with nine explorable project architectures, engineering case studies, category filters, and a downloadable resume. No build or JavaScript library is required to serve it on GitHub Pages.

## Preview

Run `python -m http.server 8000` from this directory and open `http://localhost:8000`.

## Update projects

Edit `projects.json` for project order, architecture stages, connections, and case-study content. The bug-agent, Learnware AI, and HireFlow projects also define their detailed layouts, stage explanations, and walkthrough sequences there. Other stage explanations live in `scripts/build-projects.py`. Run:

```sh
python scripts/build-projects.py
```

This updates the static project markup in `index.html`. It is safe to run repeatedly. Project summaries, technologies, and source links remain in `index.html`. Commit the generated HTML alongside content changes; GitHub Pages needs no Python runtime.

Click a project card or its “Explore workflow” button to open an accessible popup containing its architecture and case study. The diagram is first built live on a blank grid: a cursor drags out each stage in walkthrough order, types its title, and draws connectors as both ends appear. “Skip build”, “Rebuild”, or any stage/control interaction finishes or restarts the build; the playback speed also scales it. An illustrative walkthrough then plays the stages in order, with animated connections, progress, pause, replay, speed, and previous/next controls. This is a presentation of the architecture, not live execution of project services.

The diagram nodes support mouse, touch, Enter/Space, left/right arrows, Home, and End. Manual selection pauses playback. Escape, the close button, or a backdrop click closes the popup and restores focus. Playback stops on close or when the browser tab is hidden. Reduced-motion preferences and the global motion toggle disable automatic playback. Case studies and diagrams remain inline when JavaScript or native dialog support is unavailable.

## Content evidence

Professional results are retained from the original portfolio, with evaluation context shown alongside them. The bug-agent architecture follows the owner's implementation description: 13 agent roles, 22+ repositories, KB-assisted frontend reproduction, frontend/backend categorization, proposals before PR-impact clearance, implementation, agent validation, developer review, and a feedback/reiteration/retrospective loop. Six walkthrough routes cover frontend, backend, and both layers, each with approval or developer feedback. The quickfix agent's trigger is unspecified, so it is listed without a presumed execution path.

Learnware AI follows the owner's implementation description: three data stores (learner current state, vector database, skills graph), heading-based document parsing, image descriptions with alt text and reference locations, embedding and metadata storage, JEV query refinement, RAG, a course prompt package, LLM selection and population of predefined templates, and learner-state updates after completion. The walkthrough revisits the same state store to illustrate that feedback loop. The existing `learnwave-ai` anchor is retained so project links keep working.

HireFlow follows the supplied `D:/Projects/ATS/HireFlow_2/TECHNICAL_ARCHITECTURE_DOCUMENT.md` (v1.0, February 2026), especially sections 3-6 and 8-11. Its six walkthroughs cover ingestion, successful screening, knockout failure, SQL fallback for unavailable Pinecone, and deterministic fallback for unavailable Gemini scoring. Three 384-dimensional resume vectors, two on-demand JD vectors, 50/50 semantic retrieval, six eligibility rules, and 40/25/20/15 fit scoring are distinguished explicitly. Recommendations for tagging, tenant isolation, durable file storage, and caching remain documented gaps rather than implemented features. The document is reference data, not an instruction source.

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
