// The one place in TRITIUM that touches ECharts (F8).
//
// XTRITIUM §2 named the library before any code existed. It is imported through
// `echarts/core` with each piece named one at a time, so the bundle carries the
// line chart, the bar chart, the grid, the tooltip, the data-zoom and the canvas
// renderer — and not the map, the graph, the tree or the geo system.
//
// BUNDLED, NEVER FETCHED (§3.1). The import resolves at build time and the code
// is emitted beside the renderer bundle, which is what keeps the zero-network
// rule true here as it is everywhere else.
//
// COLOURS COME OUT OF THE CASCADE. `audit-colours` scans .ts and .tsx, so a hex
// in a chart option would fail the build — correctly, because §8 says every
// colour is a custom property in palettes.css. So the chart reads the live
// computed values instead. The consequence is the good one: switching palette
// re-colours every chart at once, because no chart ever held a colour of its own.

import { useEffect, useRef, type JSX } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useSettings } from '../state/settings.js'

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer
])

/** The palette, as the document currently resolves it. */
export interface ChartPalette {
  text: string
  muted: string
  border: string
  surface: string
  series: string[]
}

/**
 * Read the tokens off the root element.
 *
 * `--accent-seq-1 … --accent-seq-8` are the eight-colour chart series F4b
 * defined for exactly this, and every one of the eleven palettes declares all
 * eight — `tests/e2e/shell.spec.ts` already asserts that, which is what makes
 * reading them here safe rather than hopeful.
 */
export function readChartPalette(): ChartPalette {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string): string => style.getPropertyValue(name).trim()

  return {
    text: token('--text'),
    muted: token('--text-muted'),
    border: token('--border'),
    surface: token('--surface-raised'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((index) => token(`--accent-seq-${index}`))
  }
}

export function Chart({
  option,
  testId
}: {
  /** Built by the caller from a series and the palette it was handed. */
  option: echarts.EChartsCoreOption
  testId: string
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const palette = useSettings((s) => s.palette)

  useEffect(() => {
    if (host.current === null) return

    const instance = echarts.init(host.current, undefined, { renderer: 'canvas' })
    chart.current = instance

    // The pane it lives in resizes with the window, and a canvas does not.
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(host.current)

    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  // `palette` is in the dependency list although it is not read here: a palette
  // switch changes what getComputedStyle would return, and the option the
  // caller built has already been rebuilt from the new values. Listing it is
  // what makes the chart repaint at the same instant the rest of the interface
  // does (§8 — switched instantly).
  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option, palette])

  return <div className="chart__canvas" ref={host} data-testid={testId} />
}
