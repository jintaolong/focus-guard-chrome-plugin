/**
 * Console Manager - Suppress verbose logs in production
 * Keeps warn and error for debugging production issues
 */

export function initConsole() {
  if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    // Keep warn and error for debugging issues in production
  }
}
