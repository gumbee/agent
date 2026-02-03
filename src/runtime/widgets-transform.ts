import type { TextStreamPart, ToolSet } from "ai"
import { StructuredJson, clean, dynamic, type DescribeRegistry } from "@gumbee/structured"

/**
 * Widget event emitted by the transform.
 */
export type WidgetTransformEvent = { type: "text-delta"; text: string } | { type: "widget-delta"; index: number; widget: unknown }

/**
 * Transform a stream of TextStreamPart into an async generator that includes widget events.
 * Parses text-delta parts for widgets and emits individual widget-delta events with index
 * as widgets are progressively parsed. Uses multiple: true to handle multiple JSON segments.
 *
 * @param stream - The input ReadableStream of TextStreamPart from the AI SDK
 * @param registry - The widget registry for parsing
 * @yields TextStreamPart (passthrough) and WidgetTransformEvent (parsed widgets/preamble)
 */
export async function* transformWidgetStream(
  stream: ReadableStream<TextStreamPart<ToolSet>>,
  registry: DescribeRegistry,
): AsyncGenerator<TextStreamPart<ToolSet> | WidgetTransformEvent> {
  // Widget parsing state
  const completedWidgets: unknown[] = []
  let currentPreamble = ""
  let emittedPreambleLength = 0
  let lastEmittedIndex = -1

  // Create widget parser
  const arraySchema = dynamic().array()
  const widgetParser = new StructuredJson({
    schema: arraySchema,
    registry,
    skipPreamble: true,
    multiple: true, // Enable multi-segment parsing
    onPreamble: (text) => {
      currentPreamble += text
    },
    onComplete: (json) => {
      // Add preamble as text widget if it has non-whitespace content
      if (currentPreamble.trim()) {
        completedWidgets.push({ type: "text", text: currentPreamble })
      }
      // Add all widgets from the completed segment
      for (const widget of json as unknown[]) {
        completedWidgets.push(widget)
      }
      // Reset preamble tracking for next segment
      currentPreamble = ""
      emittedPreambleLength = 0
    },
  })

  // Helper to collect events from processing a part
  function* processTextDelta(text: string): Generator<WidgetTransformEvent> {
    widgetParser.process(text)

    // Emit any new preamble text as text-delta events
    if (currentPreamble.length > emittedPreambleLength) {
      const newPreambleText = currentPreamble.slice(emittedPreambleLength)
      yield { type: "text-delta", text: newPreambleText }
      emittedPreambleLength = currentPreamble.length
    }

    // Build current segment's widgets array
    const currentSegmentWidgets: unknown[] = []
    if (currentPreamble) {
      currentSegmentWidgets.push({ type: "text", text: currentPreamble })
    }
    if (widgetParser.value) {
      if (Array.isArray(widgetParser.value)) {
        for (const widget of widgetParser.value) {
          currentSegmentWidgets.push(widget)
        }
      } else {
        currentSegmentWidgets.push(widgetParser.value)
      }
    }

    // Build full widgets array: completed + current segment
    const allWidgets = [...completedWidgets, ...currentSegmentWidgets]

    // Emit widget deltas for new/updated widgets
    for (let i = 0; i < allWidgets.length; i++) {
      // Emit deltas for new widgets and the last widget (which may be updating)
      if (i >= lastEmittedIndex || i === allWidgets.length - 1) {
        yield { type: "widget-delta", index: i, widget: allWidgets[i] }
      }
    }
    if (allWidgets.length > 0) {
      lastEmittedIndex = allWidgets.length - 1
    }
  }

  // Helper to flush remaining events
  function* flush(): Generator<WidgetTransformEvent> {
    const preambleBeforeFinish = currentPreamble
    widgetParser.finish()

    // Emit any trailing text added by finish()
    if (currentPreamble.length > preambleBeforeFinish.length) {
      const trailingText = currentPreamble.slice(preambleBeforeFinish.length)
      yield { type: "text-delta", text: trailingText }
    }

    // Emit final widget deltas for any remaining widgets
    if (widgetParser.value) {
      const finalWidgets = [...completedWidgets]
      if (currentPreamble.trim()) {
        finalWidgets.push({ type: "text", text: currentPreamble })
      }
      for (let i = 0; i < widgetParser.value.length; i++) {
        if (i > lastEmittedIndex) {
          yield {
            type: "widget-delta",
            index: finalWidgets.length + i,
            widget: clean(widgetParser.value[i]),
          }
        }
      }
    }
  }

  // Read from the stream
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value: part } = await reader.read()
      if (done) break

      // Process text-delta parts through the widget parser
      if (part.type === "text-delta") {
        yield* processTextDelta(part.text)
      }

      // Always pass through the original part
      yield part
    }

    // Flush any remaining state
    yield* flush()
  } finally {
    reader.releaseLock()
  }
}
