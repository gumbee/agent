import type { RuntimeYield, WithMetadata } from "../runtime/types"

export type TraceStatus = "pending" | "running" | "completed" | "failed"

export interface TraceInfo {
  id: string
  name: string
  status: TraceStatus
  startTime: number
  endTime?: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface CreateTracePayload {
  id: string
  name: string
  startTime: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** Batched event payload sent from the middleware to the server */
export interface AddEventsPayload {
  traceId: string
  events: StoredEvent[]
}

/** Event wrapper with high-resolution timestamp (performance.now()) for ordering */
export interface StoredEvent {
  index: number
  ts: number
  data: WithMetadata<RuntimeYield>
}
