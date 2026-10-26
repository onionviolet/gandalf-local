# Original Gandalf materials

This is an unofficial local recreation of Lakera’s original Gandalf, for learning, outreach, and historical preservation.

| Files | Source and role | License status |
| --- | --- | --- |
| `archive/original-ui/index.html` | Historical Lakera frontend HTML, via Internet Archive | Not covered by this repository’s MIT license |
| `archive/original-ui/index-c4c036b3.js` | Historical compiled frontend, preserved as reference only | Original/vendor notices apply; not covered by this repository’s MIT license |
| `archive/original-ui/index-6cb748cb.css` | Historical stylesheet, preserved as reference only | Not covered by this repository’s MIT license |
| `docs/screenshot.png` | Screenshot of the local UI containing the recovered original artwork | Includes third-party artwork excluded from the MIT grant |
| `public/artwork/original/*.jpg` | Eight original Lakera Gandalf wizard images, via Internet Archive | Third-party artwork; not covered by this repository’s MIT license |

Source URLs, capture dates, and checksums are recorded in [the provenance manifest](archive/original-ui/provenance.json). A publicly available archived file is not evidence of an open license. Permission from Lakera to redistribute these materials has not been established. 

The local frontend uses an independently written adaptation of the original single-column layout. It does not run the archived application or its analytics. `public/wizard.svg` is our earlier original illustration and remains MIT licensed, as does the new app code.

## Replacing the images later

1. Add your own pictures under `public/artwork/custom/` using `.jpg`, `.jpeg`, `.png`, `.webp`, or `.svg` filenames containing only letters, numbers, underscores, and hyphens.
2. Update the seven paths in `public/artwork/manifest.json`. No game logic change is needed. Wide images around 2.44:1 match the original frame.
3. Refresh the page and adjust the visible artwork credit for your replacements. Keep the original archive separate if you want to retain the historical reference.

For a distribution containing only original project assets, replace the artwork paths and omit `public/artwork/original/` and `archive/original-ui/`. The archived materials can remain in a separate preservation copy.
