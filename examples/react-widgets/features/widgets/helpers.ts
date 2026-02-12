import { z } from "@gumbee/agent"

export const normalize = (v: string) => v.toLowerCase().replaceAll("-", "").replaceAll("_", "").replaceAll(" ", "").replaceAll(".", "")
export const normalizedTypeName = <T extends string>(name: T) => z.literal(name).flexible(normalize)
