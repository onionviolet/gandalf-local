# Original Gandalf frontend archive

These files preserve a historical copy of Lakera’s original Gandalf frontend as recovered from Internet Archive on October 26, 2026. The HTML capture requested is January 8, 2024. Refer to `provenance.json` for original URLs, archive replay URLs, individual artwork capture dates, byte sizes, and SHA-256 hashes.

- `index.html`, `index-c4c036b3.js`, and `index-6cb748cb.css` are archived reference files, not the local application entry point.
- The eight recovered wizard images live in `public/artwork/original/` and are used by the local app. The bonus eighth image is preserved even though this implementation has seven playable levels.
- Captures of the different image files come from different dates. This is a collection of recovered files, not a claim to a complete single-date snapshot of the service.

The original bundles contain remote service and analytics references. The local server does **not** serve this archive directory or execute those bundles. The functioning UI is adapted in `public/`, uses local assets, and calls our own server and Ollama. Archiving these files does not archive Lakera’s model service or private backend.

## Rights and attribution

Original Gandalf game, interface, and wizard artwork: Lakera. Archive access does not establish an open-source license or permission from the rights holder. These archived files and recovered images are excluded from this repository’s MIT grant; any existing notices in the recovered source remain applicable. They are retained for educational reconstruction and preservation at the project owner’s request. No affiliation with or endorsement by Lakera or Check Point is claimed.

Our independently written local application code remains MIT licensed. See `THIRD_PARTY.md` at the repository root for the scope and replacement instructions.
