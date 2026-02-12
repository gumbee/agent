import { type MedicationListWidget as MedicationListWidgetType } from "@/features/widgets"
import type { DeepPartial } from "./types"

type MedicationListWidgetProps = {
  widget: DeepPartial<MedicationListWidgetType>
}

export function MedicationListWidget({ widget }: MedicationListWidgetProps) {
  const medications = widget.medications ?? []

  return (
    <div className="flex flex-col my-[32px]">
      <p className="flex items-center text-lg font-semibold text-gray-900">
        <span className="mr-1.5 inline-block size-6 rounded bg-gray-200 align-middle" />
        Medication List
      </p>
      <hr className="border-gray-200 my-4" />
      {medications.length > 0 && (
        <div className="space-y-4">
          {medications.map((medication, index) => {
            const medicationName = medication.name ?? ""
            const medicationStrength = medication.strength
            const medicationDescription = medication.description ?? ""

            return (
              <div key={`${medicationName}-${medicationStrength ?? "none"}-${index}`} className="flex items-center gap-2">
                <div className="mb-2.5 size-6 shrink-0 rounded bg-gray-100" />
                <div className="flex flex-col flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {medicationName}
                    {medicationStrength ? <span className="ml-2 text-xs font-normal text-gray-500">{medicationStrength}</span> : null}
                  </p>
                  {medicationDescription ? <p className="mt-0.5 text-xs text-gray-700">{medicationDescription}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
