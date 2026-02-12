import * as Y from "yjs"
import * as syncProtocol from "y-protocols/sync"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"

const docs = new Map<string, Y.Doc>()

export const getYDoc = (docname: string, gc = true): Y.Doc => {
  let doc = docs.get(docname)
  if (doc === undefined) {
    doc = new Y.Doc({ gc })
    docs.set(docname, doc)
  }
  return doc
}

const messageSync = 0
const messageAwareness = 1

export const setupWS = (ws: any, doc: Y.Doc) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  try {
    ws.send(encoding.toUint8Array(encoder))
  } catch (e) {}

  const updateHandler = (update: Uint8Array, origin: any) => {
    if (origin !== ws) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeUpdate(encoder, update)
      try {
        ws.send(encoding.toUint8Array(encoder))
      } catch (e) {}
    }
  }

  doc.on("update", updateHandler)

  // Return cleanup function
  return () => {
    doc.off("update", updateHandler)
  }
}

export const handleMessage = (ws: any, doc: Y.Doc, data: any) => {
  try {
    if (typeof data === "string") return

    const uint8Array = new Uint8Array(data)
    const decoder = decoding.createDecoder(uint8Array)
    const encoder = encoding.createEncoder()
    const messageType = decoding.readVarUint(decoder)

    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, ws)
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder))
        }
        break
      case messageAwareness:
        break
    }
  } catch (e) {
    console.error("Error handling Yjs message", e)
  }
}

// Kept for backward compatibility if needed, but server.ts will use setupWS/handleMessage
export const handleYWebsocket = (ws: any, doc: Y.Doc) => {
  const cleanup = setupWS(ws, doc)
  ws.onmessage = (event: any) => handleMessage(ws, doc, event.data)
  ws.onclose = cleanup
}
