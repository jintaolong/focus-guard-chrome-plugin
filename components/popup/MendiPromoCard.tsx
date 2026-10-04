import { PROMO_COPY } from "~lib/mendi-promo"

interface MendiPromoCardProps {
  onTry: () => void
  onDismiss: () => void
}

/**
 * The Mendi promo card shown in the popup after a verdict has rendered. Presentation
 * only: eligibility, storage and analytics live in the popup and lib/mendi-promo.
 */
export const MendiPromoCard = ({ onTry, onDismiss }: MendiPromoCardProps) => {
  return (
    <section
      role="region"
      aria-label="Meet Mendi"
      data-testid="mendi-promo-card"
      style={{
        marginBottom: "16px",
        padding: "14px 16px",
        borderRadius: "12px",
        border: "1px solid #c7d2fe",
        background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)"
      }}>
      <p
        style={{
          margin: 0,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6366f1"
        }}>
        New from Comment Verdict
      </p>
      <h2
        style={{
          margin: "6px 0 6px",
          fontSize: "14px",
          fontWeight: 700,
          lineHeight: 1.35,
          color: "#1e1b4b"
        }}>
        {PROMO_COPY.headline}
      </h2>
      <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "#3730a3" }}>
        {PROMO_COPY.body}
      </p>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button
          type="button"
          onClick={onTry}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: "#4f46e5",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}>
          {PROMO_COPY.primary}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#4338ca",
            backgroundColor: "transparent",
            border: "1px solid #c7d2fe",
            borderRadius: "8px",
            cursor: "pointer"
          }}>
          {PROMO_COPY.secondary}
        </button>
      </div>
    </section>
  )
}
