// The standing layout law: nothing may overlap anything else. Every element
// owns its own space, and separation comes from fill steps, borders and gaps
// rather than from one surface floating above another.
//
// This gate is deliberately absolute — there is no inline escape pragma. When a
// genuine need appears, the exemption is written here, in the open, next to the
// rule it narrows, the way audit-colours exempts palettes.css by name.
//
// One accepted gap: rules run line by line, so a shadow declared across two
// lines (the inset keyword on its own line) would read as unallowed. The
// codebase writes shadows on one line, so this is left alone rather than
// rebuilt around multi-line declarations.

import { walk, collect, report, SRC } from './lib/scan.mjs'

const rules = [
  // Out of flow: the element no longer reserves the space it paints.
  {
    pattern: /\bposition\s*:\s*['"]?(absolute|fixed|sticky)\b/,
    why: 'positioning out of normal flow lets an element paint over its neighbours'
  },
  { pattern: /\bz-?[Ii]ndex\s*:/, why: 'a stacking order is only ever needed when things stack' },
  {
    pattern: /\bfloat\s*:\s*['"]?(left|right|inline-start|inline-end)\b/,
    why: 'a float leaves normal flow and content wraps around it'
  },

  // Pulling a box outside its own margin box, and the centring-over idiom.
  // calc() is safe here: the spec requires whitespace around a binary +/- so
  // "calc(100% - 4px)" never collides with the "-4px" this rule looks for.
  {
    pattern: /\bmargin[A-Za-z-]*\s*:\s*(?:[^;{}]*[\s(])?-[.\d]/,
    why: 'a negative margin drags an element into its neighbour'
  },
  {
    pattern: /translate(?:[XY]|3d)?\s*\(\s*-50%/,
    why: 'the translate(-50%) centring hack positions an element over another'
  },

  // Paint outside the border box. An inset shadow cannot cross into a
  // neighbour, so it is the one form of depth this app allows.
  {
    pattern: /\bbox-?[Ss]hadow\s*:/,
    why: 'an outer shadow paints outside the border box, onto the neighbour (inset only)',
    allow: (line) => /\binset\b/.test(line) || /\bbox-?[Ss]hadow\s*:\s*['"]?none\b/.test(line)
  },
  {
    pattern: /\btext-?[Ss]hadow\s*:/,
    why: 'a text shadow paints outside the glyph box',
    allow: (line) => /\btext-?[Ss]hadow\s*:\s*['"]?none\b/.test(line)
  },
  { pattern: /\bdrop-shadow\s*\(/, why: 'drop-shadow() paints outside the element' },
  {
    pattern: /\bbackdrop-?[Ff]ilter\s*:/,
    why: 'backdrop-filter only means anything when a surface sits over another, and is unavailable on Linux'
  },

  // The platform's overlay primitives, old and new. Matched on a word
  // boundary plus the method-call form, not a bare substring, so a comment
  // that merely mentions "popovers" in passing does not trip the gate while
  // the attribute, the target-invoker attributes and the show/hide/toggle
  // calls all still do.
  {
    pattern: /\bpopover(?:target(?:action)?)?\b|\.\s*(?:show|hide|toggle)Popover\s*\(/i,
    why: 'the Popover API paints in the top layer, over everything'
  },
  {
    pattern: /\b(anchor-name|position-anchor|position-area)\s*:/,
    why: 'CSS anchor positioning exists to tether an overlay to an element'
  },
  { pattern: /<dialog\b/, why: 'a dialog element covers content; forms open as real windows' },
  { pattern: /\bshowModal\s*\(/, why: 'a modal dialog covers content; forms open as real windows' },
  {
    pattern: /\brole\s*=\s*['"{]?\s*['"]?(dialog|alertdialog|tooltip|menu|listbox)\b/,
    why: 'this role describes a construct that conventionally overlays content'
  },
  {
    pattern: /\stitle\s*=\s*['"{]/,
    why: 'the title attribute renders a native tooltip over whatever is beneath it'
  },
  {
    pattern: /\bwindow\s*\.\s*(alert|confirm|prompt)\s*\(|(?:^|[^.\w])(alert|prompt)\s*\(/,
    why: 'a browser dialog blocks and covers the window'
  },

  // No context or popup menus: select-and-copy serves the real need.
  { pattern: /\bbuildFromTemplate\b/, why: 'no context or popup menus' },
  { pattern: /\.\s*popup\s*\(/, why: 'no context or popup menus' },

  // An overlay surface has no meaning in a layout where nothing overlaps.
  {
    pattern: /surface-?[Oo]verlay|--overlay\b/,
    why: 'an overlay surface token has no meaning when nothing overlaps'
  }
]

const files = walk(SRC, ['.css', '.ts', '.tsx', '.js', '.mjs', '.html'])

report('audit-overlap', collect(files, rules))
