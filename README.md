# FANUC Simulator 2000

Independent, browser-based educational simulator for FANUC-style programs. Version **v0.60**. Not affiliated with FANUC.

## Run

Open `index.html` in a modern browser (or serve the folder with any static web server). No dependencies or machine connection.

## What it does

- **One machine selector** (menu bar, *Machine*): **Milling (0i-MF style, 3-axis)** or **Turning (0i-TF style, 2-axis lathe)**. It switches the simulator and views, the CNC panel, the tool library, the stock setup, the demos and the G/M code library together, and is remembered. Each machine keeps its own editor document.
- **Milling**: G0/G1/G2/G3 (I J or R), G4, G17, G20/G21, G28, G40/G41/G42 cutter compensation (D), G43/G49 (H), G53, G54–G59, G73/G76/G81–G89 drilling cycles, G90/G91, G94/G95, G98/G99, M0/M1/M3/M4/M5/M6/M8/M9/M19/M29/M30. Unknown machine-specific M codes (e.g. M46, M50) are no-ops with a note.
- **Turning**: X is a diameter, U/W incremental, G2/G3 with R or I/K (rear-turret convention: +X up, +Z right), G32, G4, G28/G30, G50 (speed clamp and coordinate setting), G53, G54–G59, G90/G92/G94 (modal), G70/G71/G72/G73/G74/G75/G76 (two-block formats), G96/G97, G98/G99, Txxyy with geometry/wear offsets (X Z R T) and tool nose radius compensation G41/G42.
- **Custom macro B** for both machines: local #1–#33 (per G65 call), common #100–#199 / #500–#999 (retained), arithmetic and functions, IF[..]GOTO / IF[..]THEN, GOTO (forward search first), WHILE[..]DOm / ENDm, G65 argument mapping, M98/M99, nesting limits, system variables (#3000, #3006, #3901, #4001…, #5001…, #5021…, #5201… work offsets, tool offsets), PRM[], G10 L2 / L10–L13 / P / L52.
- **Parameters** (Setup › Parameters or CNC panel SYSTEM): rapid type 1401 LRP, rapid rates 1420, F0 1421, max feed 1422, jog 1423/1424, reference 1240, stroke limits 1320/1321, accel time constants 1620/1622, DPI 3401, power-on G01 3402, spindle clamp 3772, cycle parameters 5130–5143. Changes made by a program (G10 L52) take effect from that block on.
- **Real-time playback** from programmed feeds and rapid rates with feed (0–150 %), rapid (F0/25/50/100 %) and spindle overrides, single block, optional stop (M01), block skip (/), dwell and cycle time estimate.
- **Tools and stock**: editable mill tools (diameter, corner radius, flute and overall length, point angle; H/D offsets) and lathe inserts (ISO shape C/D/V/W/T/S/R, nose radius, tip T0–T9, holder angle, groove/thread width), saved in the browser with reset. Lathe stock is a solid bar or a tube (OD, bore, length, face). Material removal uses the actual tool outline.
- **CNC panel** (Program › CNC Panel): POS / PROG / OFS/SET / SYSTEM / MESSAGE screens, EDIT / MEM / MDI / JOG / HANDLE / REF modes, CYCLE START / FEED HOLD / RESET, word-based INSERT / ALTER / DELETE, CAN, EOB, O-number and word search, program directory.
- **G/M code library** (Help) with separate Milling and Turning entries, realistic examples and address tables.

## Project layout

- `src/nc/`: machine data and parameters, macro executor, offset geometry.
- `src/simulation/`: mill interpreter and stock. `src/lathe/`: lathe interpreter, removal model and view.
- `src/sim/runtime.js`: shared real-time playback clock.
- `src/renderer/`: CPU, GPU and viewport drawing. `src/tools/`: mill tool library.
- `src/ui/`: menus, CNC panel, machine selector, code library, demos, HUD.
- `tests/`: `npm test` (source checks + node:test unit tests); `tests/headless_check.py` browser check (python playwright + Chrome).

Ordered classic scripts with shared state; the simulation modules are UMD so the tests run them in Node.

## Limitations

Educational visualization only: no machine control, no collision checking, no certified tool data. The mill stock is a height field, the lathe stock a per-Z radius profile. Behaviour follows the FANUC 0i manuals as closely as practical, but machine builders change many details (M codes, parameters, G code system); always check against your machine's documentation.
