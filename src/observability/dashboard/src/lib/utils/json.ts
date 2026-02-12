// Safe JSON serializer to handle circular references and large objects
export function safeStringify(obj: any, space = 2): string {
  const seen = new WeakSet()

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]"
        }
        seen.add(value)
      }

      return value
    },
    space,
  )
}
