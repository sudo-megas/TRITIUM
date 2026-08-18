// Every tab except Settings and About is the real two-pane layout with empty
// cells. XTRITIUM §7 — no "get started" screens anywhere in TRITIUM.

import type { JSX } from 'react'

const LEFT_CELLS = 12
const RIGHT_CELLS = 8

export function Cells({ count }: { count: number }): JSX.Element {
  return (
    <div className="cells">
      {Array.from({ length: count }, (_, index) => (
        <div className="cell" key={index} />
      ))}
    </div>
  )
}

export function EmptyPanes(): JSX.Element {
  return (
    <div className="panes">
      <section className="pane">
        <Cells count={LEFT_CELLS} />
      </section>
      <section className="pane">
        <Cells count={RIGHT_CELLS} />
      </section>
    </div>
  )
}
