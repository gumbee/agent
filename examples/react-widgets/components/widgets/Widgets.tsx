import type { UiChatWidget } from "@/features/widgets"
import { MedicationDetailWidget } from "./MedicationDetailWidget"
import { MedicationListWidget } from "./MedicationListWidget"
import { SymptomListWidget } from "./SymptomListWidget"
import { TextWidget } from "./TextWidget"
import type { DeepPartial } from "./types"

type WidgetsProps = {
  widget: DeepPartial<UiChatWidget>
  showStreamingIndicator?: boolean
}

export function Widgets({ widget, showStreamingIndicator }: WidgetsProps) {
  if (widget.type === "text") {
    return <TextWidget widget={widget} showStreamingIndicator={showStreamingIndicator} />
  }
  if (widget.type === "medication_list") {
    return <MedicationListWidget widget={widget} />
  }
  if (widget.type === "symptoms_list") {
    return <SymptomListWidget widget={widget} />
  }
  if (widget.type === "medication_detail") {
    return <MedicationDetailWidget widget={widget} />
  }
  return null
}
