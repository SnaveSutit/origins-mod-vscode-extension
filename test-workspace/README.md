# Test Workspace

Fixture data for manually testing the extension. Press **F5** (or Run > Start Debugging,
"Run Extension") in the main repo window - this opens a new Extension Development Host
window with this folder as its workspace, with the extension loaded from your local build.

- `data/testpack/origins/human.json` - a valid origin
- `data/testpack/origins/invalid_example.json` - deliberately invalid (wrong types),
  open it to confirm the red squiggles show up
- `data/testpack/origin/second_origin.json` - same schema via the singular folder alias
- everything else under `data/testpack/` - one valid example per schema type
  (powers, origin_layers, badges, global_powers, skill_trees, keybindings)

Edit these files freely, or add new ones under `data/<namespace>/<type>/` to try out
autocomplete, hover docs, and validation for other fields.
