import { useState } from "react"
import { AuthService } from "~lib/auth"

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  onGuestLogin: () => Promise<void>
  isLoading: boolean
}

export const LoginForm = ({ onLogin, onGuestLogin, isLoading }: LoginFormProps) => {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setError("")
    setIsGoogleLoading(true)

    try {
      const { tabId, state } = await AuthService.initiateGoogleLogin()
      
      // Notify background script to monitor this tab
      await chrome.runtime.sendMessage({
        type: 'OAUTH_START',
        tabId,
        state
      })

      console.log("LoginForm: OAuth flow started, closing popup")
      
      // Close the popup - user will reopen it after OAuth completes
      // Background script will handle token storage and user info fetching
      window.close()
    } catch (err) {
      setIsGoogleLoading(false)
      setError(err instanceof Error ? err.message : "Google login failed")
    }
  }

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
            justifyContent: "center"
          }}>
          <img src={chrome.runtime.getURL("assets/stroke.png")} alt="Comment Verdict" style={{ width: "32px", height: "32px" }} />
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
            : "Join Comment Verdict to analyze YouTube video comments"}
        </p>
      </div>

      {/* Google Sign In Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading || isGoogleLoading}
        style={{
          width: "100%",
          padding: "12px",
          marginBottom: "16px",
          fontSize: "14px",
          fontWeight: "600",
          color: "#1a1a1a",
          backgroundColor: "white",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          cursor: (isLoading || isGoogleLoading) ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          if (!isLoading && !isGoogleLoading) {
            e.currentTarget.style.backgroundColor = "#f9fafb"
            e.currentTarget.style.borderColor = "#d1d5db"
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading && !isGoogleLoading) {
            e.currentTarget.style.backgroundColor = "white"
            e.currentTarget.style.borderColor = "#e5e5e5"
          }
        }}>
        {isGoogleLoading ? (
          <>Loading...</>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      {/* Guest / Visitor Login */}
      <button
        type="button"
        onClick={async () => {
          setError("")
          setIsGuestLoading(true)
          try {
            await onGuestLogin()
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to continue as visitor")
          } finally {
            setIsGuestLoading(false)
          }
        }}
        disabled={isLoading || isGuestLoading}
        style={{
          width: "100%",
          padding: "11px",
          marginBottom: "4px",
          fontSize: "13px",
          fontWeight: "500",
          color: "#6b7280",
          backgroundColor: "transparent",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          cursor: (isLoading || isGuestLoading) ? "not-allowed" : "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          if (!isLoading && !isGuestLoading) {
            e.currentTarget.style.backgroundColor = "#f9fafb"
            e.currentTarget.style.borderColor = "#d1d5db"
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading && !isGuestLoading) {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.borderColor = "#e5e5e5"
          }
        }}>
        {isGuestLoading ? "Loading..." : "Continue as Visitor"}
      </button>
      <p style={{ marginTop: "4px", marginBottom: "16px", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
        No sign-up needed — free verdict &amp; sentiment analysis instantly.
      </p>

      <div style={{
        display: "flex",
        alignItems: "center",
        margin: "16px 0",
        color: "#9ca3af",
        fontSize: "12px"
      }}>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
        <span style={{ padding: "0 12px" }}>OR</span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
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
