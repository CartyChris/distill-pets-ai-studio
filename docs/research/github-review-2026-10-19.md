# GitHub integration review — 2026-10-19

GitHub metadata and the weekly trending page were checked on this date. Star counts are a point-in-time popularity signal, not a quality or security guarantee. Pushed dates can include automated changes.

| Project | Stars | Latest push | License | Decision |
| --- | ---: | --- | --- | --- |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | 90,738 | 2026-10-18 | MIT | Integrated the real local Mermaid parser/renderer; editable source and validated exports. |
| [thesysdev/openui](https://github.com/thesysdev/openui) | 11,855 | 2026-10-17 | MIT | Reviewed its component-catalog approach. Pip uses an original constrained native schema renderer, rather than claiming OpenUI SDK compatibility. |
| [vercel-labs/json-render](https://github.com/vercel-labs/json-render) | 18,717 | 2026-10-13 | Apache-2.0 | Reviewed bounded component schemas and explicit actions; its React renderer is not included in this vanilla JavaScript app. |
| [huggingface/transformers.js](https://github.com/huggingface/transformers.js) | 16,352 | 2026-10-15 | Apache-2.0 | Useful future optional local embeddings; not bundled because model downloads and phone memory require a separate opt-in design. |
| [microsoft/agent-lightning](https://github.com/microsoft/agent-lightning) | 18,746 | 2026-10-09 | MIT | Relevant external training infrastructure; not embedded and no training job is launched. |
| [stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) | 38,684 | 2026-10-18 | MIT | Relevant external optimization/evaluation framework; bounded review layers here are an original JavaScript implementation, not DSPy optimization. |
| [mksglu/context-mode](https://github.com/mksglu/context-mode) | 30,762 | 2026-10-19 | NOASSERTION | Appeared on weekly trending. Not copied: GitHub did not identify a standard SPDX license. Bounded local context remains explicit. |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | 66,755 | 2026-10-19 | Apache-2.0 | Appeared on weekly trending. Useful for exported video compositions; not required for an interactive Canvas world. |
| [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | 57,711 | 2026-10-16 | MIT | Appeared on weekly trending. Reviewed as a diagram-design reference; no source or assets copied. |

The trending-page check was made directly against https://github.com/trending?since=weekly. The other candidates were selected by relevance and recent activity, not represented as a historical trending ranking.

Only Mermaid and DOMPurify are new runtime dependencies in this upgrade. No remote rendering service receives diagram source. Generative UI is a local allowlisted renderer: generated HTML, scripts and arbitrary model-defined code do not run in the parent application.

The browser sends live inference to OpenRouter only when the user requests it. Model chips and reviewed workflow memory supply context; they do not modify hosted weights. External projects listed as reviewed are not installed integrations.
