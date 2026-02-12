import type { Symptom } from "@/features/widgets"
import type { DeepPartial } from "./types"

type SeverityGroupProps = {
  label: string
  symptoms?: Array<DeepPartial<Symptom>>
}

export function SeverityGroup({ label, symptoms }: SeverityGroupProps) {
  if (!symptoms?.length) return null

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <div className="space-y-4">
        {symptoms.map((symptom, index) => {
          const symptomName = symptom.name ?? ""
          const bodyPart = symptom.bodyPart ? symptom.bodyPart.replaceAll("_", " ") : ""

          return (
            <div key={`${label}-${symptomName}-${bodyPart}-${index}`} className="flex items-center gap-2">
              <div className="mb-2.5 size-6 shrink-0 rounded bg-gray-100" />
              <div className="flex flex-col flex-1">
                <p className="text-sm font-semibold text-gray-900">{symptomName}</p>
                {bodyPart ? <p className="mt-0.5 text-xs text-gray-700">{bodyPart}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
