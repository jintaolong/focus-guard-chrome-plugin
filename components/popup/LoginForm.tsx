import { useState } from "react"

interface LoginFormProps {
  onLogin: (email: string) => void
  isLoading: boolean
}

export const LoginForm = ({ onLogin, isLoading }: LoginFormProps) => {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Basic email validation
    if (!email.trim()) {
      setError("Please enter your email")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    onLogin(email)
  }

  return (
    <div
      style={{
        padding: "32px 24px",
        textAlign: "center"
      }}>
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            margin: "0 auto 16px",
            backgroundColor: "#3b82f6",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px"
          }}>
          🛡️
        </div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1a1a1a",
            marginBottom: "8px"
          }}>
          Welcome to Focus Guard
        </h2>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Sign in to start curating your YouTube experience
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: "14px",
            border: error ? "2px solid #dc2626" : "1px solid #e5e5e5",
            borderRadius: "8px",
            outline: "none",
            transition: "border-color 0.2s",
            backgroundColor: isLoading ? "#fafafa" : "white",
            boxSizing: "border-box"
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = "#3b82f6"
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.target.style.borderColor = "#e5e5e5"
            }
          }}
        />

        {error && (
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#dc2626",
              textAlign: "left"
            }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "12px",
            fontSize: "14px",
            fontWeight: "600",
            color: "white",
            backgroundColor: isLoading ? "#9ca3af" : "#3b82f6",
            border: "none",
            borderRadius: "8px",
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = "#2563eb"
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = "#3b82f6"
            }
          }}>
          {isLoading ? "Signing in..." : "Continue"}
        </button>
      </form>
    </div>
  )
}
