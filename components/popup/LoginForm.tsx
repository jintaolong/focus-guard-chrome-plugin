import { useState } from "react"
import { AuthService } from "~lib/auth"

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  isLoading: boolean
}

export const LoginForm = ({ onLogin, isLoading }: LoginFormProps) => {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Basic validation
    if (!email.trim()) {
      setError("Please enter your email")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (!password.trim()) {
      setError("Please enter your password")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (mode === "register" && !fullName.trim()) {
      setError("Please enter your full name")
      return
    }

    try {
      if (mode === "register") {
        // Register first
        await AuthService.register({ 
          email, 
          password, 
          full_name: fullName || undefined 
        })
        // Then auto-login
        await onLogin(email, password)
      } else {
        // Direct login
        await onLogin(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
    }
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
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h2>
        <p style={{ fontSize: "14px", color: "#666" }}>
          {mode === "login" 
            ? "Sign in to continue" 
            : "Join Focus Guard to start curating your YouTube experience"}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
        {mode === "register" && (
          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "6px", 
              fontSize: "13px", 
              fontWeight: "500",
              color: "#374151"
            }}>
              Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "14px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                outline: "none",
                transition: "border-color 0.2s",
                backgroundColor: isLoading ? "#fafafa" : "white",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6"
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e5e5"
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: "12px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "6px", 
            fontSize: "13px", 
            fontWeight: "500",
            color: "#374151"
          }}>
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
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
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "6px", 
            fontSize: "13px", 
            fontWeight: "500",
            color: "#374151"
          }}>
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "14px",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              outline: "none",
              transition: "border-color 0.2s",
              backgroundColor: isLoading ? "#fafafa" : "white",
              boxSizing: "border-box"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6"
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e5e5"
            }}
          />
          <p style={{ 
            marginTop: "4px", 
            fontSize: "11px", 
            color: "#6b7280" 
          }}>
            Minimum 8 characters
          </p>
        </div>

        {error && (
          <p
            style={{
              marginBottom: "12px",
              padding: "12px",
              fontSize: "13px",
              color: "#dc2626",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px"
            }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
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
          {isLoading 
            ? (mode === "login" ? "Signing in..." : "Creating account...") 
            : (mode === "login" ? "Sign In" : "Create Account")}
        </button>

        <div style={{ 
          marginTop: "16px", 
          textAlign: "center",
          fontSize: "13px",
          color: "#6b7280"
        }}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                disabled={isLoading}
                style={{
                  color: "#3b82f6",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: "500"
                }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                disabled={isLoading}
                style={{
                  color: "#3b82f6",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: "500"
                }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
