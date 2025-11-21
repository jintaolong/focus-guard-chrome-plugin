// Background service worker for MV3
export {}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Focus Guard extension installed!")
})

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request)
  
  if (request.action === "getData") {
    chrome.storage.sync.get(["data"], (result) => {
      sendResponse({ data: result.data })
    })
    return true // Keep the message channel open for async response
  }
  
  return false
})

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log("Tab updated:", tab.url)
  }
})
