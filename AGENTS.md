<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commit and push workflow

After every meaningful, verified chunk of work, commit it with a clear message and push it to the current branch's remote. This is the project default; do not wait for a separate reminder or confirmation. Keep commits focused, preserve unrelated work, and never commit credentials or local environment files. If a check or push fails, resolve it when possible and report any remaining blocker.

## Design standard

Use `.agents/skills/apple-design/SKILL.md` for UI work across this project. Build on the existing Illinois Abundance design: preserve its palette, handwritten headings, and layouts unless a redesign is requested. Favor clear hierarchy, immediate feedback, consistent controls, comfortable touch targets, and accessible motion. Make focused improvements when needed; do not restyle working pages solely to resemble Apple's branding.

Keep the interface minimal and premium: lead with a title and a short, useful description. Omit decorative labels above headings, filler taglines, ornamental numbering, and repeated explanations. Keep navigation, meaningful status, form guidance, privacy notices, and sample-content labels clear.

Apply relevant installed skills proactively as the work calls for them. For UI and motion work, use the applicable design, animation, performance, and mobile skills without waiting for the user to name each one.
