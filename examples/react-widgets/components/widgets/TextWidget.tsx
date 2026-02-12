import type { TextWidget as TextWidgetType } from "@/features/widgets"
import type { DeepPartial } from "./types"

type TextWidgetProps = {
  widget: DeepPartial<TextWidgetType>
  showStreamingIndicator?: boolean
}

export function TextWidget({ widget, showStreamingIndicator }: TextWidgetProps) {
  const text = widget.text

  return (
    <p className="whitespace-pre-wrap my-[16px]">
      {text ?? ""}
      {showStreamingIndicator && text?.trim().length ? (
        <span className="ml-[4px] inline-block size-3 rounded-full bg-gray-500 align-middle animate-throb" />
      ) : null}
    </p>
  )
}
