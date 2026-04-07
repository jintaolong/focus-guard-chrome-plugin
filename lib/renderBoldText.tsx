import { ReactNode } from "react"

export function renderBoldMarkup(value: string | null | undefined): ReactNode {
  if (!value) return ""

  const parts = value.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    const match = /^\*\*(.+)\*\*$/.exec(part)
    if (match) {
      return (
        <strong key={idx} style={{ fontWeight: 800, fontSize: "1.05em" }}>
          {match[1]}
        </strong>
      )
    }
    return part
  })
}
