// LaunchPulse Chrome Extension - Content Script
// Extracts data from LinkedIn company and profile pages

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    const data = extractLinkedInData();
    sendResponse(data);
  }
  return true;
});

function extractLinkedInData() {
  const url = window.location.href;

  // Company page: linkedin.com/company/*
  if (url.includes("/company/")) {
    return extractCompanyData();
  }

  // Profile page: linkedin.com/in/*
  if (url.includes("/in/")) {
    return extractPersonData();
  }

  return { type: "unknown" };
}

function extractCompanyData() {
  try {
    // Company name - try multiple selectors for reliability
    const nameSelectors = [
      'h1.org-top-card-summary__title',
      'h1.top-card-layout__title',
      '.org-top-card-summary-info-list h1',
      'h1[data-test-id="org-name"]',
      '.org-top-card__primary-content h1'
    ];
    
    let name = "";
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        name = el.textContent?.trim() || "";
        break;
      }
    }

    // Employee count - parse from various formats like "1,001-5,000 employees"
    const employeeSelectors = [
      '.org-top-card-summary-info-list__info-item:nth-child(2)',
      '[data-test-id="employee-count"]',
      '.org-about-company-module__company-staff-count-range',
      '.t-normal.t-black--light.link-without-visited-state'
    ];

    let employeeCount = null;
    for (const selector of employeeSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent || "";
        const match = text.match(/(\d{1,3}(?:,\d{3})*(?:-\d{1,3}(?:,\d{3})*)?)\s*employees?/i);
        if (match) {
          // Parse range like "1,001-5,000" and take the higher number
          const range = match[1].replace(/,/g, "");
          if (range.includes("-")) {
            employeeCount = parseInt(range.split("-")[1], 10);
          } else {
            employeeCount = parseInt(range, 10);
          }
          break;
        }
      }
    }

    // Also check the main page content for employee text
    if (!employeeCount) {
      const pageText = document.body.innerText;
      const employeeMatch = pageText.match(/(\d{1,3}(?:,\d{3})*)\+?\s*employees?/i);
      if (employeeMatch) {
        employeeCount = parseInt(employeeMatch[1].replace(/,/g, ""), 10);
      }
    }

    // Industry
    const industrySelectors = [
      '.org-top-card-summary-info-list__info-item:first-child',
      '.org-top-card-module__info-item:first-child',
      '.org-about-company-module__industry'
    ];

    let industry = "";
    for (const selector of industrySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || "";
        // Filter out employee counts
        if (!text.includes("employee")) {
          industry = text;
          break;
        }
      }
    }

    // Website domain - look for website link
    const websiteSelectors = [
      'a[data-control-name="about_website"]',
      '.org-about-us-organization-description__link',
      'a[href*="redirect"]',
      '.link-without-visited-state[href^="http"]'
    ];

    let domain = "";
    for (const selector of websiteSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        let href = el.getAttribute("href") || "";
        // Handle LinkedIn redirect URLs
        if (href.includes("linkedin.com/redir")) {
          const urlMatch = href.match(/url=([^&]+)/);
          if (urlMatch) {
            href = decodeURIComponent(urlMatch[1]);
          }
        }
        // Extract domain from URL
        try {
          const url = new URL(href);
          domain = url.hostname.replace(/^www\./, "");
        } catch {
          domain = href.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
        }
        break;
      }
    }

    // Location (headquarters)
    const locationSelectors = [
      '.org-top-card-summary-info-list__info-item:last-child',
      '.org-about-company-module__headquarters',
      '.org-locations__headquarters'
    ];

    let city = "";
    let country = "";
    for (const selector of locationSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || "";
        // Parse location like "San Francisco, California, United States"
        const parts = text.split(",").map(p => p.trim());
        if (parts.length >= 2) {
          city = parts[0];
          country = parts[parts.length - 1];
        } else if (parts.length === 1) {
          country = parts[0];
        }
        break;
      }
    }

    // LinkedIn URL (current page)
    const linkedinUrl = window.location.href.split("?")[0];

    return {
      type: "company",
      data: {
        name,
        domain,
        employee_count: employeeCount,
        industry,
        city,
        country,
        linkedin_url: linkedinUrl
      }
    };

  } catch (error) {
    console.error("Error extracting company data:", error);
    return { type: "error", error: error.message };
  }
}

function extractPersonData() {
  try {
    // Full name
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1.inline',
      '.pv-text-details__left-panel h1',
      '.pv-top-card--list h1'
    ];

    let fullName = "";
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        fullName = el.textContent?.trim() || "";
        break;
      }
    }

    // Split name into first and last
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Title/Headline
    const titleSelectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel .text-body-medium',
      '.pv-top-card--list .text-body-medium'
    ];

    let title = "";
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        title = el.textContent?.trim() || "";
        break;
      }
    }

    // Current company from experience section or headline
    const companySelectors = [
      '.pv-text-details__right-panel-item-text',
      '.experience-group-position__company-name',
      '.pv-entity__secondary-title'
    ];

    let companyName = "";
    for (const selector of companySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        companyName = el.textContent?.trim() || "";
        break;
      }
    }

    // If no company found, try to extract from title (e.g., "CEO at Acme Corp")
    if (!companyName && title.includes(" at ")) {
      companyName = title.split(" at ")[1]?.trim() || "";
    }

    // Location
    const locationSelectors = [
      '.text-body-small.inline',
      '.pv-text-details__left-panel .text-body-small',
      '.pv-top-card--list-bullet li:first-child'
    ];

    let location = "";
    for (const selector of locationSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        location = el.textContent?.trim() || "";
        // Filter out "Contact info" link text
        if (!location.toLowerCase().includes("contact")) {
          break;
        }
      }
    }

    // LinkedIn URL
    const linkedinUrl = window.location.href.split("?")[0];

    return {
      type: "person",
      data: {
        first_name: firstName,
        last_name: lastName,
        title,
        company_name: companyName,
        location,
        linkedin_url: linkedinUrl
      }
    };

  } catch (error) {
    console.error("Error extracting person data:", error);
    return { type: "error", error: error.message };
  }
}
