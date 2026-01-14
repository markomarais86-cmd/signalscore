// LaunchPulse Chrome Extension - Popup Script

const SUPABASE_URL = "https://dhyfbaptcprxxixgnpby.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/chrome-extension-enrich`;

// DOM Elements
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const apiKeyInput = document.getElementById("api-key");
const saveSettingsBtn = document.getElementById("save-settings");

const notLinkedinMsg = document.getElementById("not-linkedin");
const loadingEl = document.getElementById("loading");
const noApiKeyMsg = document.getElementById("no-api-key");
const companyDataEl = document.getElementById("company-data");
const personDataEl = document.getElementById("person-data");
const successMsg = document.getElementById("success-message");
const errorMsg = document.getElementById("error-message");
const errorText = document.getElementById("error-text");

const saveCompanyBtn = document.getElementById("save-company");
const savePersonBtn = document.getElementById("save-person");

let extractedData = null;
let pageType = null;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  // Load saved API key
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }

  // Check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url?.includes("linkedin.com")) {
    showElement(notLinkedinMsg);
    return;
  }

  if (!apiKey) {
    showElement(noApiKeyMsg);
    return;
  }

  // Extract data from LinkedIn page
  extractDataFromPage(tab.id);
});

// Settings toggle
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

// Save settings
saveSettingsBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    await chrome.storage.sync.set({ apiKey });
    settingsPanel.classList.add("hidden");
    
    // Re-check page after saving API key
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url?.includes("linkedin.com")) {
      hideAllMessages();
      extractDataFromPage(tab.id);
    }
  }
});

// Refresh page button
document.getElementById("refresh-page-btn")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    await chrome.tabs.reload(tab.id);
    window.close();
  }
});

// Save company button
saveCompanyBtn.addEventListener("click", async () => {
  if (!extractedData || pageType !== "company") return;
  await saveToLaunchPulse("company", extractedData);
});

// Save person button
savePersonBtn.addEventListener("click", async () => {
  if (!extractedData || pageType !== "person") return;
  await saveToLaunchPulse("person", extractedData);
});

// Extract data from LinkedIn page
async function extractDataFromPage(tabId) {
  showElement(loadingEl);

  try {
    // First, inject the content script programmatically (in case it wasn't loaded)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    } catch (injectionError) {
      // Script may already be injected, that's OK
      console.log("Script injection note:", injectionError.message);
    }

    // Small delay to ensure script is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now send the message
    const response = await chrome.tabs.sendMessage(tabId, { action: "extractData" });
    
    hideAllMessages();

    if (response.type === "company") {
      pageType = "company";
      extractedData = response.data;
      displayCompanyData(response.data);
    } else if (response.type === "person") {
      pageType = "person";
      extractedData = response.data;
      displayPersonData(response.data);
    } else {
      showElement(notLinkedinMsg);
      document.getElementById("detection-help").classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error extracting data:", error);
    hideAllMessages();
    showElement(notLinkedinMsg);
    document.getElementById("detection-help").classList.remove("hidden");
  }
}

// Display company data
function displayCompanyData(data) {
  document.getElementById("company-name").textContent = data.name || "-";
  document.getElementById("company-domain").textContent = data.domain || "-";
  document.getElementById("company-employees").textContent = 
    data.employee_count ? data.employee_count.toLocaleString() : "-";
  document.getElementById("company-industry").textContent = data.industry || "-";
  document.getElementById("company-location").textContent = 
    [data.city, data.country].filter(Boolean).join(", ") || "-";
  
  showElement(companyDataEl);
}

// Display person data
function displayPersonData(data) {
  document.getElementById("person-name").textContent = 
    `${data.first_name || ""} ${data.last_name || ""}`.trim() || "-";
  document.getElementById("person-title").textContent = data.title || "-";
  document.getElementById("person-company").textContent = data.company_name || "-";
  document.getElementById("person-location").textContent = data.location || "-";
  
  showElement(personDataEl);
}

// Save to LaunchPulse
async function saveToLaunchPulse(type, data) {
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  
  if (!apiKey) {
    showError("Please configure your API key first");
    return;
  }

  // Disable button
  const btn = type === "company" ? saveCompanyBtn : savePersonBtn;
  btn.disabled = true;
  btn.innerHTML = `
    <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
    Saving...
  `;

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        data,
        api_key: apiKey,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      hideAllMessages();
      showElement(successMsg);
    } else {
      showError(result.error || "Failed to save data");
    }
  } catch (error) {
    console.error("Save error:", error);
    showError("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2"/>
        <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2"/>
      </svg>
      Save to LaunchPulse
    `;
  }
}

// Helper functions
function showElement(element) {
  element.classList.remove("hidden");
}

function hideAllMessages() {
  notLinkedinMsg.classList.add("hidden");
  loadingEl.classList.add("hidden");
  noApiKeyMsg.classList.add("hidden");
  companyDataEl.classList.add("hidden");
  personDataEl.classList.add("hidden");
  successMsg.classList.add("hidden");
  errorMsg.classList.add("hidden");
}

function showError(message) {
  errorText.textContent = message;
  showElement(errorMsg);
}
