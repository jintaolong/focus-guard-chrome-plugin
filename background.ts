// Background service worker for MV3 - API Proxy
// Content scripts cannot make cross-origin requests due to CORS.
// All API calls must go through the background worker.

export {}

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://test.commentverdict.com/api/v1"

chrome.runtime.onInstalled.addListener(() => {
  console.log("Focus Guard extension installed!")
})

// Helper to make API requests from background (bypasses CORS)
async function makeAPIRequest(endpoint: string, options: any = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  console.log("Background: Making API request to", url)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    console.log("Background: Response status", response.status)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      
      // Special cases: Some endpoints return 400 for "no data" scenarios (treat as success)
      
      // Topic gap analysis returns 400 when no gaps found
      if (endpoint.includes('/topic-gap') && response.status === 400 && 
          error.detail?.includes('Minimal Topic Gaps Identified')) {
        console.log("Background: Topic gap - no gaps found (success)")
        return { 
          success: true, 
          data: { 
            topic_gaps: [],
            message: error.detail 
          } 
        }
      }
      
      // Topic clustering returns 400 when parsing fails (treat as empty clusters)
      if (endpoint.includes('/topic-clustering') && response.status === 400 && 
          error.detail?.includes('Failed to parse LLM')) {
        console.log("Background: Topic clustering - parse failed, returning empty clusters")
        return { 
          success: true, 
          data: { 
            topic_clusters: [],
            message: error.detail 
          } 
        }
      }
      
      return { success: false, error: error.detail || response.statusText, status: response.status }
    }

    // Check if response is a blob (for report downloads)
    const contentType = response.headers.get('content-type')
    if (contentType && (contentType.includes('application/pdf') || contentType.includes('text/plain'))) {
      const blob = await response.blob()
      // Convert blob to base64 for message passing
      const base64 = await blobToBase64(blob)
      return { success: true, data: base64, contentType, isBlob: true }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error("Background: Fetch error", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background: Message received", request.type)
  
  // Handle API proxy requests
  if (request.type === 'API_REQUEST') {
    makeAPIRequest(request.endpoint, request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep channel open for async response
  }
  
  // Legacy getData support
  if (request.action === "getData") {
    chrome.storage.sync.get(["data"], (result) => {
      sendResponse({ data: result.data })
    })
    return true
  }
  
  return false
})
