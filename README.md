# FANUC Simulator 2000

Independent, browser-based educational visualization prototype. Development baseline: **v0.25**. Not affiliated with FANUC.

## Run

Download or clone the repository, then open `index.html` in a modern browser. No dependencies or machine connection are required. If local-file loading is restricted, serve the folder with a local static web server.

The application has a 3D viewport, program editor, virtual stock and tools, a simulation-only macro inspector, and hybrid WebGL 2 / CPU software rendering. Choose the backend in View > Graphics settings. The startup program demo uses ordinary unwrapped viewer input; four new macro graphics demos use the independent arithmetic sandbox to draw abstract color, mosaic, wave and rosette patterns. Their values never affect CNC motion or stock. The Help menu contains a searchable, read-only G/M terminology reference with 76 entries, category filtering, conceptual diagrams, individual word annotations, non-executable examples and viewer status. It is not an operating guide; tool-specific path colors, a legend and active tool name are displayed in the viewport. The tool library includes 65 editable visual presets with manufacturer, category and family selectors. Family labels are catalog-inspired; geometry is synthetic and not certified manufacturer data. The Default library adds finishing, angle, disk and specialty profiles. Newly modeled specialty silhouettes are display-only and do not remove virtual stock; the existing flat, rounded, ball and pointed profiles retain approximate surface visualization.

The Inspect menu also contains a separate arithmetic calculator with numbered variables, bracketed expressions, degree-based trigonometry, conditions, bounded calculation-only loops, comment descriptions and stepwise value inspection. It does not execute CNC commands, affect motion or change stock.

Graphics settings include Performance, Balanced and CAD Ultra display presets, studio lighting, three display materials and optional soft silhouette shadows. These are display-only changes; underlying geometry and playback remain unchanged. CAD Ultra increases screen sampling and can be slower on CPU. Hardware WebGL testing remains pending.

The main program editor now has a dark CMD-inspired theme. File > Parameter demo · 3D draft loads a calculation-only rosette overlay into the main viewport. The main playback controls and macro inspector track its arithmetic steps; editing resets playback. The overlay does not generate CNC commands or change virtual stock.

File > Parameter demo · Material study adds a parameter-driven display morph with an animated non-contact reference model synchronized to playback and center-section diagram. The temporary display mesh is independent of actual stock and motion; no tool contact or cutting computation is performed.

File > Macro demo · Combined graphics uses numbered parameters, nested arithmetic loops and simulator-specific DRAW statements to display an abstract mosaic. It shares the calculation timeline and main viewport; no machine motion or stock writes occur.

## Project layout

- `src/state.js`: shared application state.
- `src/simulation/`: virtual program interpretation and stock visualization.
- `src/macros/`: simulation-only macro expansion.
- `src/tools/`: editable virtual tool geometry.
- `src/renderer/`: CPU, GPU and viewport drawing.
- `src/ui/`: menus, controls, HUD and styles.
- `assets/`: project logo.
- `tests/`: dependency-free source checks.

These are ordered classic JavaScript scripts with shared state, not independent ES modules yet. This preserves the original offline prototype's behavior during the initial split.

Run `npm test` with Node.js installed to check syntax and source references. Run `npm run build` to generate a self-contained HTML preview in `dist/`.

## Development

Keep `main` as the testable baseline. Use `develop` and feature branches for changes, then review them in pull requests. Priorities: hardware GPU verification, improved visual contour reconstruction, and eventual standalone packaging.

## Limitations

Educational visualization only. No machine control, safety or collision validation, certified tool data, native Macro B execution, or machining verification. The approximate heightfield geometry is not a CAD solid. The GPU path needs hardware testing; CPU fallback remains available.
