# Play, nature walks and postcards

Open **Open World → Play**. There is also an **Open the play corner** shortcut in
Pets. All of these activities run locally, without an API key or model call.

## Give the duo a break

Choose a pocket picnic, dance, bubbles, story, high five or cloud watching. Both
companions walk together before the activity begins. Their existing species,
outfit, aura and signature color stay visible. After five to eight seconds of
play, they resume their previous walking routes. If they are far apart, gathering
takes longer: the characters walk rather than teleporting.

**Finish play break** cancels immediately; an interrupted activity does not count
as a completed memory. **Pause scenery** freezes the activity too. Choosing a new
destination or regenerating the world interrupts the break. Leaving the world
or hiding the browser stops its animation loop; returning resumes the scenery.
Scenic controls do not pause, cancel, approve or alter a model request.

## A passport for small discoveries

Choose one of four walks: meadow, archive, coast or workshop. Each offers three
landmarks. **Walk to…** sends the companions to the next stop; a stamp is added
when the lead companion reaches it. **Look** and **Inspect** do not award stamps.
Repeated arrivals do not duplicate a visit. The passport stays with the workspace
when you regenerate the landscape.

The journal keeps the latest 32 visits, completed activities and created
postcards. Counters are bounded; these are cosmetic keepsakes, not model quality
scores. **Download field journal** exports only this scenic history as JSON.
Regular workspace backups also include it. Clearing browser data removes the
local journal unless you restore a workspace backup.

## Make an actual postcard

1. Open the postcard camera from Play.
2. Choose landscape (16:9), square (1:1) or portrait (9:16).
3. Use **Frame the duo**, drag/pinch to compose, and **Say berries!** for a wave.
4. Add a caption and select **Make postcard**.
5. Download the PNG. On iPhone, **Open image**, then Share → Save Image.

The visible crop matches the output ratio. Exports include a small caption and
are limited to 1,600 pixels on the longest edge, with no stretching. Postcards
contain the actual generated landscape and pets. Returned resource cards, model
speech bubbles and the app interface are omitted. Pet names and your chosen
caption are included. The image is made locally and is never uploaded by this tool.

Only the most recent postcard preview is kept in memory. Download it before
making the next one or leaving the Wilds. The journal stores its timestamp and
format, not the image file. You can close the camera with **Back** or Escape.

## Accessibility and implementation

Every activity and trail has an ordinary keyboard-accessible button. The atlas
provides text access to scenic locations. Controls are at least 44 pixels tall;
photo inputs use 16-pixel text on phones. OS or in-app reduced motion switches
moving props and sprite poses to static versions, while preserving activity
completion and text status. Canvas animations pause in hidden tabs. Paused
scenery limits redraws to four per second while keeping live state current;
camera gestures still redraw immediately.

- `playbook.js`: sanitized, bounded state; landmark/trail catalog; crop geometry.
- `world-play.js`: one activity at a time, gathering, cancellation, restoring
  walking routes, and procedural blankets/books/bubbles/notes.
- `world-engine.js`: drawing, navigation arrival callbacks, pair framing and PNG
  capture. The canvas keeps native 36×48 sprite proportions.
- `play-panel.js` / `world-play.css`: responsive controls and passport.
- `adventure.js`: integration, announcements, transient photo preview and exports.

No new dependency, paid service, remote asset or training requirement is added.
The existing Rust/WASM core and reviewed teaching pipeline remain available.
