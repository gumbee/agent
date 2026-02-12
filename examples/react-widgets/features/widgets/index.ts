import { z } from "@gumbee/agent"
import { normalize, normalizedTypeName } from "./helpers"

export const Symptom = z.object({
  name: z.string().describe("The name of the symptom or condition. (E.g 'Headache', 'Nausea', 'Fever')"),
  // accept part, area, bodyArea as aliases. Also normalize names, so body-part and body_part and boDYPaRt are all accepted
  bodyPart: z
    .enum(["chest", "abdomen", "head", "throat", "ears", "nose", "mouth", "eyes", "forehead", "back", "legs", "feet", "arms", "whole_body"])
    .describe("The body part that the symptom is located in.")
    .alias(["part", "area", "bodyArea"])
    .flexible(normalize),
})

export const TextWidget = z.object({
  type: normalizedTypeName("text"),
  // accept content, value, body as aliases for the field name of the "text" field
  text: z.string().describe("Markdown text to render in the chat.").alias(["content", "value", "body"]),
})

export const MedicationDetailWidget = z.object({
  type: normalizedTypeName("medication_detail"),
  // accept medication, medication_name, title, name as aliases for the field name of the "name" field. Normalize so medication-name and medication_name are both accepted
  name: z.string().alias(["medication", "medication_name", "title", "name"]).flexible(normalize),
  strength: z.string().optional(),
  dosage: z.string().describe("The dosage of the medication. (E.g '1 pill', '2 tablets')"),
  frequency: z.string().describe("The frequency of the medication. (E.g '2 times a day', '3 times a week')"),
  instructions: z.string().optional(),
  sideEffects: z.object({
    common: z.array(Symptom),
    occasional: z.array(Symptom),
    rare: z.array(Symptom),
  }),
})

export const MedicationListWidget = z.object({
  type: normalizedTypeName("medication_list"),
  medications: z
    .object({
      name: z.string().describe("The name of the medication. (E.g 'Ibuprofen', 'Paracetamol')"),
      strength: z.string().optional().describe("The strength of the medication. (E.g '200mg', '500mg')"),
      description: z.string().describe("The more detailed description of the medication. (E.g 'A pain reliever and anti-inflammatory drug.')"),
    })
    .array(),
})

export const SymptomListWidget = z.object({
  type: normalizedTypeName("symptoms_list"),
  symptoms: z.object({
    common: z.array(Symptom),
    occasional: z.array(Symptom),
    rare: z.array(Symptom),
  }),
})

// Utility Type (shared in other widgets)
export type Symptom = z.infer<typeof Symptom>

// Widget Types
export type TextWidget = z.infer<typeof TextWidget>
export type MedicationDetailWidget = z.infer<typeof MedicationDetailWidget>
export type MedicationListWidget = z.infer<typeof MedicationListWidget>
export type SymptomListWidget = z.infer<typeof SymptomListWidget>

// Ui Chat Widget Union
export type UiChatWidget = SymptomListWidget | MedicationListWidget | MedicationDetailWidget | TextWidget
