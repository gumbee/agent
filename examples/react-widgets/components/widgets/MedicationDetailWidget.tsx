import { SeverityGroup } from "./SeverityGroup"
import type { DeepPartial } from "./types"
import type { MedicationDetailWidget as MedicationDetailWidgetType } from "@/features/widgets"

type MedicationDetailWidgetProps = {
  widget: DeepPartial<MedicationDetailWidgetType>
}

export function MedicationDetailWidget({ widget }: MedicationDetailWidgetProps) {
  const { name, dosage, frequency, instructions, sideEffects, strength } = widget
  const medicationName = name ?? ""
  const dosageLabel = dosage ?? ""
  const frequencyLabel = frequency ?? ""
  const commonSideEffects = sideEffects?.common ?? []
  const occasionalSideEffects = sideEffects?.occasional ?? []
  const rareSideEffects = sideEffects?.rare ?? []

  return (
    <div className="flex flex-col items-start my-[32px] w-full">
      <div className="flex items-start pb-5">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline mr-2">
          <path d="M23 23V28H18V30H23V35H25V30H30V28H25V23H23Z" fill="currentColor" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9 7C9 5.34315 10.3431 4 12 4H36C37.6569 4 39 5.34315 39 7V15C39 16.6569 37.6569 18 36 18V41C36 42.6569 34.6569 44 33 44H15C13.3431 44 12 42.6569 12 41L12 18C10.3431 18 9 16.6569 9 15V7ZM14 18H34V41C34 41.5523 33.5523 42 33 42H15C14.4477 42 14 41.5523 14 41V18ZM36 16H32V6H36C36.5523 6 37 6.44772 37 7V15C37 15.5523 36.5523 16 36 16ZM30 6H25V16H30V6ZM12 6H16L16 16H12C11.4477 16 11 15.5523 11 15V7C11 6.44772 11.4477 6 12 6ZM18 16V6H23L23 16H18Z"
            fill="currentColor"
          />
        </svg>
        <p className="text-lg font-semibold text-gray-900 flex flex-col items-start">
          {medicationName}
          {strength ? <span className="text-xs font-normal text-gray-500">{strength}</span> : null}
        </p>
      </div>
      <div className="border-t border-gray-200 pt-5 flex flex-col w-full">
        <div className="space-y-3">
          {dosageLabel && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Dosage:</span> {dosageLabel}
            </p>
          )}
          {frequencyLabel && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Frequency:</span> {frequencyLabel}
            </p>
          )}
        </div>
        {instructions ? (
          <p className="mt-3 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Instructions:</span> {instructions}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-[1fr_1fr_1fr]">
          <SeverityGroup label="Common side effects" symptoms={commonSideEffects} />
          <SeverityGroup label="Occasional side effects" symptoms={occasionalSideEffects} />
          <SeverityGroup label="Rare side effects" symptoms={rareSideEffects} />
        </div>
      </div>
    </div>
  )
}
