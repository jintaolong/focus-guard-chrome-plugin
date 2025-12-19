/**
 * Console Manager - Suppress verbose logs in production
 * Keeps warn and error for debugging production issues
 * 
 * Logs are suppressed when:
 * - COMMENT_VERDICT_DEBUG is explicitly set to "0" or "false"
 * - OR NODE_ENV=production (production build)
 * - When undefined, default to enabled in development, suppressed in production
 */

export function initConsole() {
  const debugEnv = process.env.COMMENT_VERDICT_DEBUG
  const isProduction = process.env.NODE_ENV === 'production'
  
  // If debugEnv is undefined, use NODE_ENV to decide
  // If debugEnv is explicitly set, use that value
  let shouldSuppress: boolean
  if (debugEnv === undefined) {
    // Default: suppress in production, enable in development
    shouldSuppress = isProduction
  } else {
    // Explicit setting: "0" or "false" means suppress
    shouldSuppress = debugEnv === "0" || debugEnv === "false"
  }
  
  if (shouldSuppress) {
    // Show one final message before suppressing
    console.log("🔇 Console logs suppressed (COMMENT_VERDICT_DEBUG=" + debugEnv + ", NODE_ENV=" + process.env.NODE_ENV + ")")
    
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    // Keep warn and error for debugging issues in production
  } else {
    console.log("🔊 Console logs enabled (COMMENT_VERDICT_DEBUG=" + debugEnv + ", NODE_ENV=" + process.env.NODE_ENV + ")")
  }
}
