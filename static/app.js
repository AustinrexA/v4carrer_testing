"use strict";

const API = {
  jobs: "/api/jobs",
  sources: "/api/sources",
  companies: "/api/companies",
  careerSources: "/api/company-career-sources",
  locations: "/api/locations",
  health: "/api/health",
  dashboard: "/api/dashboard/stats",
};
const state = {
  page: 1,
  perPage: 10,
  total: 0,
  totalPages: 1,
  jobs: [],
  sources: [],
  selectedSourceIds: new Set(),
  sourcesInitialized: false,
  selectedCompanyNames: new Set(),
  companies: [],
  careerSources: [],
  selectedCareerSourceIds: new Set(),
  roleOptions: [],
  experienceOptions: [],
  locations: [],
  filters: {
    role: "",
    location: "",
    experience: "",
    source_id: "",
    source_ids: "",
    company: "",
    skills: "",
    posted_after: "",
    status: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "INR",
    salary_period: "",
  },
  sortBy: "id",
  sortDirection: "desc",
  excludedJobs: new Set(),
  activeSourceName: "All websites",
};

const elements = {
  companiesToggle: document.getElementById("companiesToggle"),
  companyOptions: document.getElementById("companyOptions"),
  jobsPage: document.getElementById("jobsPage"),
  dashboardPage: document.getElementById("dashboardPage"),
  salaryFilterInput: document.getElementById("salaryFilterInput"),
  reportsPage: document.getElementById("reportsPage"),
  pageTitle: document.getElementById("pageTitle"),
  filterForm: document.getElementById("filterForm"),
  searchInput: document.getElementById("searchInput"),
  locationInput: document.getElementById("locationInput"),
  locationDropdownToggle: document.getElementById("locationDropdownToggle"),
  locationOptions: document.getElementById("locationOptions"),
  experienceInput: document.getElementById("experienceInput"),
  companyInput: document.getElementById("companyInput"),
  skillsInput: document.getElementById("skillsInput"),
  postedDateInput: document.getElementById("postedDateInput"),
  statusFilter: document.getElementById("statusFilter"),
  moreFilters: document.getElementById("moreFilters"),
  moreFiltersToggle: document.getElementById("moreFiltersToggle"),
  jobsTableBody: document.getElementById("jobsTableBody"),
  resultCount: document.getElementById("resultCount"),
  sourceSummary: document.getElementById("sourceSummary"),
  paginationInfo: document.getElementById("paginationInfo"),
  currentPageLabel: document.getElementById("currentPageLabel"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  selectAllJobs: document.getElementById("selectAllJobs"),
  notification: document.getElementById("notification"),
  sourceOptions: document.getElementById("sourceOptions"),
  selectAllPortals: document.getElementById("selectAllPortals"),
  selectAllCareerSites: document.getElementById("selectAllCareerSites"),
  sourceMenu: document.getElementById("sourceMenu"),
  jobPortalToggle: document.getElementById("jobPortalToggle"),
  sidebar: document.getElementById("sidebar"),
};

let notificationTimeout = null;
let jobsRequestSequence = 0;

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function displayValue(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return escapeHTML(value);
}

function showNotification(message, isError = false) {
  elements.notification.textContent = message;
  elements.notification.className = "notification show";

  if (isError) {
    elements.notification.classList.add("error");
  }

  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  notificationTimeout = setTimeout(() => {
    elements.notification.className = "notification";
  }, 3500);
}

async function apiGet(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result.error || `Request failed with status ${response.status}.`,
    );
  }

  return result;
}

/* Build the jobs API URL. */
function buildJobsURL() {
  const params = new URLSearchParams();

  params.set("page", state.page);
  params.set("per_page", state.perPage);
  params.set("source_ids", getSelectedSourceIds().join(","));

  const selectedRole = (state.filters.role || "").trim();

  if (selectedRole) {
    params.set("role", selectedRole);
  }

  if (state.filters.location) {
    params.set("location", state.filters.location);
  }

  if (state.filters.company) {
    params.set("company", state.filters.company);
  }

  state.selectedCompanyNames.forEach((name) =>
    params.append("companies", name),
  );

  if (state.filters.experience)
    params.set("experience", state.filters.experience);
  [
    "skills",
    "posted_after",
    "status",
    "salary_min",
    "salary_max",
    "salary_currency",
    "salary_period",
  ].forEach((key) => {
    if (state.filters[key] !== undefined && state.filters[key] !== "")
      params.set(key, state.filters[key]);
  });

  return `${API.jobs}?${params.toString()}`;
}

function showLoading() {
  elements.jobsTableBody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-state">
                <div class="loading-indicator"></div>
                <p>Loading job listings...</p>
            </td>
        </tr>
    `;
}

function showTableMessage(message) {
  elements.jobsTableBody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-state">
                ${escapeHTML(message)}
            </td>
        </tr>
    `;
}

function normalizeSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map((skill) => String(skill).trim()).filter(Boolean);
  }

  if (typeof skills === "string" && skills.trim()) {
    try {
      const parsed = JSON.parse(skills);

      if (Array.isArray(parsed)) {
        return parsed.map((skill) => String(skill).trim()).filter(Boolean);
      }
    } catch {
      return skills
        .split(/[,;|]/)
        .map((skill) => skill.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatus(job) {
  return String(job.status || "active").toLowerCase();
}

function renderSkills(skills) {
  const list = normalizeSkills(skills);

  if (!list.length) {
    return "—";
  }

  return `
        <div class="skills-list">
            ${list
              .slice(0, 5)
              .map(
                (skill) => `
                <span class="skill-tag">${escapeHTML(skill)}</span>
            `,
              )
              .join("")}
            ${
              list.length > 5
                ? `<span class="skill-tag">+${list.length - 5}</span>`
                : ""
            }
        </div>
    `;
}

function safeJobURL(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

function renderJobRow(job) {
  const id = Number(job.id);
  const checked = state.excludedJobs.has(id) ? "checked" : "";
  const jobURL = safeJobURL(job.job_url);
  const salaryText =
    job.salary_min != null || job.salary_max != null
      ? `${job.salary_currency || "INR"} ${job.salary_min != null ? Number(job.salary_min).toLocaleString("en-IN") : "—"}–${job.salary_max != null ? Number(job.salary_max).toLocaleString("en-IN") : "—"}${job.salary_period ? ` / ${escapeHTML(job.salary_period)}` : ""}`
      : "Not disclosed";
  const jobLink = jobURL
    ? `<a class="job-link" href="${escapeHTML(jobURL)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`
    : "—";
  return `
        <tr>
            <td class="checkbox-column"><input type="checkbox" class="job-checkbox" data-job-id="${Number.isSafeInteger(id) ? id : ""}" aria-label="Exclude job ${Number.isSafeInteger(id) ? id : ""} from export" ${checked}></td>
            <td class="job-title-cell" title="View job details: ${escapeHTML(job.title || "—")}"><button type="button" class="job-title-button" data-job-details-id="${Number.isSafeInteger(id) ? id : ""}" aria-label="View details for ${escapeHTML(job.title || "job")}">${displayValue(job.title)}</button></td>
            <td class="company-cell">${displayValue(job.company)}</td>
            <td class="location-cell">${displayValue(job.location)}</td>
            <td>${displayValue(job.experience)}</td>
            <td class="salary-cell">${escapeHTML(salaryText)}</td>
            <td>${escapeHTML(formatDate(job.posted_at))}</td>
            <td>${jobLink}</td>
        </tr>`;
}

function detailText(value, fallback = "Not provided") {
  const text = String(value == null ? "" : value).trim();
  return text ? escapeHTML(text) : fallback;
}

function cleanJobDetailText(value) {
  return String(value == null ? "" : value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJobKeyPoints(rawDescription, rawSkills) {
  const source = cleanJobDetailText(rawDescription);
  const skills = cleanJobDetailText(rawSkills);
  const combined = [
    source,
    skills && !source.toLowerCase().includes(skills.toLowerCase())
      ? `Key skills: ${skills}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (!combined) return [];

  // Split dense scraped descriptions into readable points instead of reproducing
  // the source portal's full paragraph verbatim.
  const chunks = combined
    .replace(/\s*[•●▪►]\s*/g, "\n")
    .replace(
      /\s+(?=(?:Responsibilities|Requirements|Qualifications|What you.ll do|What you will do|Skills|Minimum qualification|Preferred qualification)\s*:)/gi,
      "\n",
    )
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])|;\s+/)
    .map((part) => part.replace(/^[\s\-–—:|]+|[\s\-–—|]+$/g, "").trim())
    .filter((part) => part.length >= 12);

  const points = [];
  const seen = new Set();
  for (let chunk of chunks) {
    chunk = chunk.replace(/\s+/g, " ").trim();
    if (!chunk) continue;
    // If a source provides one very long run-on line, divide it into useful
    // phrase-sized points without dropping the remaining information.
    if (chunk.length > 220) {
      const phrases = chunk.split(/,\s+(?=[A-Z])/);
      if (phrases.length > 1) {
        chunk = phrases.join(". ");
      }
    }
    const key = chunk
      .toLowerCase()
      .replace(/[^\w]+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    points.push(chunk);
  }
  return points.slice(0, 12);
}

function showJobDetails(jobId) {
  const job = state.jobs.find((item) => Number(item.id) === Number(jobId));
  if (!job) return;
  const modal = document.getElementById("jobDetailsModal");
  const url = safeJobURL(job.job_url);
  const salary =
    job.salary_min != null || job.salary_max != null
      ? `${job.salary_currency || "INR"} ${job.salary_min != null ? Number(job.salary_min).toLocaleString("en-IN") : "—"} – ${job.salary_max != null ? Number(job.salary_max).toLocaleString("en-IN") : "—"}${job.salary_period ? ` / ${job.salary_period}` : ""}`
      : "Not disclosed";
  document.getElementById("jobDetailsTitle").textContent =
    job.title || "Job details";
  document.getElementById("jobDetailsCompany").textContent =
    job.company || "Company not specified";
  document.getElementById("jobDetailsMeta").innerHTML = `
        <div class="job-detail-fact"><span>Location</span><strong>${detailText(job.location)}</strong></div>
        <div class="job-detail-fact"><span>Experience</span><strong>${detailText(job.experience)}</strong></div>
        <div class="job-detail-fact"><span>Salary</span><strong>${escapeHTML(salary)}</strong></div>
        <div class="job-detail-fact"><span>Posted</span><strong>${escapeHTML(formatDate(job.posted_at))}</strong></div>
        <div class="job-detail-fact"><span>Source</span><strong>${detailText(job.source_name)}</strong></div>`;
  const points = extractJobKeyPoints(job.description, job.skills);
  const descriptionElement = document.getElementById("jobDetailsDescription");
  descriptionElement.innerHTML = points.length
    ? `<ul class="job-details-key-points">${points.map((point) => `<li>${escapeHTML(point)}</li>`).join("")}</ul>`
    : `<p class="job-details-empty-description">The source did not provide enough description details for a summary. Use the original listing for the full requirements.</p>`;
  const link = document.getElementById("jobDetailsApplyLink");
  link.hidden = !url;
  if (url) link.href = url;
  modal.dataset.activeJobId = String(job.id);
  modal.hidden = false;
  document.body.classList.add("job-details-open");
  document.getElementById("jobDetailsClose").focus();
}

function closeJobDetails() {
  const modal = document.getElementById("jobDetailsModal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("job-details-open");
}

function exportJobDetails() {
  const modal = document.getElementById("jobDetailsModal");
  if (!modal || modal.hidden) return;
  window.print();
}

function renderJobs() {
  if (!state.jobs.length) {
    showTableMessage(
      state.selectedSourceIds.size === 0 &&
        state.selectedCareerSourceIds.size === 0
        ? "No job sources selected. Select a job portal or company to display jobs."
        : "No jobs found for the selected source. Try refreshing or changing your filters.",
    );

    elements.selectAllJobs.checked = false;
    elements.selectAllJobs.indeterminate = false;
    return;
  }

  elements.jobsTableBody.innerHTML = state.jobs.map(renderJobRow).join("");
  updateSelectionCheckbox();
}

function updatePagination() {
  const start = state.total === 0 ? 0 : (state.page - 1) * state.perPage + 1;

  const end = Math.min(state.page * state.perPage, state.total);

  elements.resultCount.textContent = state.total.toLocaleString("en-IN");

  elements.paginationInfo.textContent = `Showing ${start}–${end} of ${state.total.toLocaleString("en-IN")} records`;

  elements.currentPageLabel.textContent = `Page ${state.page} of ${state.totalPages}`;

  document.getElementById("firstPageButton").disabled = state.page <= 1;
  document.getElementById("previousPageButton").disabled = state.page <= 1;
  document.getElementById("nextPageButton").disabled =
    state.page >= state.totalPages;
  document.getElementById("lastPageButton").disabled =
    state.page >= state.totalPages;
}

function updateSelectionCheckbox() {
  const visibleIds = state.jobs
    .map((job) => Number(job.id))
    .filter((id) => Number.isSafeInteger(id));

  const selectedVisible = visibleIds.filter((id) =>
    state.excludedJobs.has(id),
  ).length;

  elements.selectAllJobs.checked =
    visibleIds.length > 0 && selectedVisible === visibleIds.length;

  elements.selectAllJobs.indeterminate =
    selectedVisible > 0 && selectedVisible < visibleIds.length;
}
async function loadJobs() {
  const requestSequence = ++jobsRequestSequence;

  if (
    state.selectedSourceIds.size === 0 &&
    state.selectedCareerSourceIds.size === 0
  ) {
    state.jobs = [];
    state.total = 0;
    state.totalPages = 1;
    state.page = 1;

    renderJobs();
    updatePagination();
    return;
  }

  showLoading();

  try {
    const result = await apiGet(buildJobsURL());

    // An older response must not replace results for a newer filter selection.
    if (requestSequence !== jobsRequestSequence) {
      return;
    }

    state.jobs = Array.isArray(result.data) ? result.data : [];

    const pagination = result.pagination || {};

    state.total = Number(pagination.total) || 0;
    state.totalPages = Math.max(1, Number(pagination.total_pages) || 1);

    if (state.page > state.totalPages) {
      state.page = state.totalPages;
      return loadJobs();
    }

    state.jobs.sort((a, b) => {
      const first = a[state.sortBy] ?? "";
      const second = b[state.sortBy] ?? "";

      const comparison = String(first).localeCompare(
        String(second),
        undefined,
        { numeric: true, sensitivity: "base" },
      );

      return state.sortDirection === "asc" ? comparison : -comparison;
    });

    renderJobs();
    updatePagination();
  } catch (error) {
    if (requestSequence !== jobsRequestSequence) {
      return;
    }

    console.error("Unable to load jobs:", error);

    showTableMessage(
      "Unable to load jobs. Check that Flask is running and the database is connected.",
    );

    showNotification(error.message, true);

    state.jobs = [];
    state.total = 0;
    state.totalPages = 1;

    updatePagination();
  }
}

async function loadSources() {
  try {
    const result = await apiGet(API.sources);
    const previouslySelectedNames = new Set(
      state.sources
        .filter((source) => state.selectedSourceIds.has(Number(source.id)))
        .map((source) => source.name),
    );
    const visiblePortalNames = new Set([
      "foundit",
      "glassdoor",
      "indeed",
      "internshala",
      "naukri",
      "timesjobs",
      "wellfound",
    ]);
    state.sources = (Array.isArray(result.data) ? result.data : []).filter(
      (source) =>
        visiblePortalNames.has(
          String(source.name || "")
            .trim()
            .toLowerCase(),
        ),
    );
    if (!state.sourcesInitialized) {
      // Start with no portals selected; the user explicitly chooses sources.
      state.selectedSourceIds = new Set();
      state.sourcesInitialized = true;
    } else {
      state.selectedSourceIds = new Set(
        state.sources
          .filter((source) => previouslySelectedNames.has(source.name))
          .map((source) => Number(source.id)),
      );
    }
    syncSourceFilter();
    renderSourceOptions();
  } catch (error) {
    console.error("Unable to load sources:", error);
    showNotification("Unable to load job websites.", true);
  }
}

function renderSourceOptions() {
  if (!elements.sourceOptions) return;
  elements.sourceOptions.innerHTML =
    `<label class="source-checkbox-item source-select-all-item"><input type="checkbox" data-select-all-portals><span class="source-label">Select all</span></label>` +
    state.sources
      .map((source) => {
        const id = Number(source.id);
        const checked = state.selectedSourceIds.has(id) ? "checked" : "";
        return `
            <label class="source-checkbox-item" title="${escapeHTML(source.name)} job count">
                <input type="checkbox" data-source-id="${id}" ${checked}>
                <span class="source-label">${escapeHTML(source.name)}</span>
                <span class="source-count">${(Number(source.job_count) || 0).toLocaleString("en-IN")}</span>
            </label>`;
      })
      .join("");
  const master = elements.sourceOptions.querySelector(
    "[data-select-all-portals]",
  );
  syncMasterCheckbox(
    master,
    state.selectedSourceIds.size,
    state.sources.length,
  );
}

function syncMasterCheckbox(node, selectedCount, totalCount) {
  if (!node) return;
  node.checked = totalCount > 0 && selectedCount === totalCount;
  node.indeterminate = selectedCount > 0 && selectedCount < totalCount;
}

function getSelectedSourceIds() {
  return [
    ...new Set(
      [...state.selectedSourceIds, ...state.selectedCareerSourceIds]
        .map(Number)
        .filter(Number.isFinite),
    ),
  ];
}

function syncSourceFilter() {
  const selectedIds = getSelectedSourceIds();
  state.filters.source_ids = selectedIds.join(",");
  const selectedPortalNames = state.sources
    .filter((source) => state.selectedSourceIds.has(Number(source.id)))
    .map((source) => source.name);
  const selectedCompanyNames = state.careerSources
    .filter((source) => state.selectedCareerSourceIds.has(Number(source.id)))
    .map(
      (source) =>
        source.company || source.name.replace(/ Careers$| Jobs$/i, ""),
    );
  const selectedNames = [...selectedPortalNames, ...selectedCompanyNames];
  state.activeSourceName = selectedNames.length
    ? selectedNames.join(", ")
    : "No sources selected";
  if (elements.sourceSummary)
    elements.sourceSummary.textContent = state.activeSourceName;
}

/* Faceted role, location, and experience dropdowns are backed by current database filters. */
function buildFacetParams(exclude = "") {
  const params = new URLSearchParams();
  const salaryBand = elements.salaryFilterInput
    ? elements.salaryFilterInput.value
    : "";
  const salaryParts = salaryBand ? salaryBand.split("-") : [];
  const values = {
    role: elements.searchInput.value.trim(),
    location: elements.locationInput.value.trim(),
    experience: elements.experienceInput.value.trim(),
    company: elements.companyInput ? elements.companyInput.value.trim() : "",
    source_ids: getSelectedSourceIds().join(","),
    salary_min: salaryParts[0] || "",
    salary_max: salaryParts.length > 1 ? salaryParts[1] : "",
    salary_currency: "INR",
    salary_period: "year",
  };
  Object.entries(values).forEach(([key, value]) => {
    if (key === "source_ids") params.set(key, value);
    else if (key !== exclude && value !== "") params.set(key, value);
  });
  state.selectedCompanyNames.forEach((name) =>
    params.append("companies", name),
  );
  return params;
}

async function loadSalaryFilterOptions() {
  if (!elements.salaryFilterInput) return;
  const previous = elements.salaryFilterInput.value;
  const bands = [
    { value: "0-300000", label: "Up to ₹3 LPA", min: 0, max: 300000 },
    { value: "300000-500000", label: "₹3–5 LPA", min: 300000, max: 500000 },
    { value: "500000-800000", label: "₹5–8 LPA", min: 500000, max: 800000 },
    { value: "800000-1200000", label: "₹8–12 LPA", min: 800000, max: 1200000 },
    {
      value: "1200000-2000000",
      label: "₹12–20 LPA",
      min: 1200000,
      max: 2000000,
    },
    {
      value: "2000000-",
      label: "₹20 LPA and above",
      min: 2000000,
      max: Infinity,
    },
  ];
  try {
    const params = buildFacetParams("salary");
    params.delete("salary_min");
    params.delete("salary_max");
    params.delete("salary_currency");
    params.delete("salary_period");
    params.delete("page");
    params.delete("per_page");
    const result = await apiGet(
      `${API.jobs}?${params.toString()}&page=1&per_page=100`,
    );
    const jobs = Array.isArray(result.data) ? result.data : [];
    const available = bands.filter((band) =>
      jobs.some((job) => {
        if (job.salary_min == null && job.salary_max == null) return false;
        const low = Number(job.salary_min ?? job.salary_max);
        const high = Number(job.salary_max ?? job.salary_min);
        return (
          Number.isFinite(low) &&
          Number.isFinite(high) &&
          high >= band.min &&
          low <= band.max
        );
      }),
    );
    elements.salaryFilterInput.innerHTML =
      '<option value="">Select Salary</option>' +
      available
        .map((band) => `<option value="${band.value}">${band.label}</option>`)
        .join("");
    elements.salaryFilterInput.value = available.some(
      (b) => b.value === previous,
    )
      ? previous
      : "";
  } catch (error) {
    console.error("Unable to load salary options:", error);
  }
}

async function loadFilterOptions() {
  const previousRole = elements.searchInput.value;
  const previousExperience = elements.experienceInput.value;
  try {
    const result = await apiGet(
      `/api/filter-options?${buildFacetParams().toString()}`,
    );
    state.roleOptions = Array.isArray(result.roles) ? result.roles : [];
    state.experienceOptions = Array.isArray(result.experiences)
      ? result.experiences
      : [];
    // /api/filter-options already returns locations using the same dependent
    // filters as /api/locations. Reuse that result instead of issuing a second
    // database request on every initial load/filter change.
    state.locations = extractLocationOptions(
      Array.isArray(result.locations) ? result.locations : [],
    );
    renderLocationOptions();

    elements.searchInput.innerHTML =
      '<option value="">Select job</option>' +
      state.roleOptions
        .map(
          (item) =>
            `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`,
        )
        .join("");
    elements.searchInput.value = state.roleOptions.includes(previousRole)
      ? previousRole
      : "";
    state.filters.role = elements.searchInput.value;

    elements.experienceInput.innerHTML =
      '<option value="">Select experience</option>' +
      state.experienceOptions
        .map(
          (item) =>
            `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`,
        )
        .join("");
    elements.experienceInput.value = state.experienceOptions.includes(
      previousExperience,
    )
      ? previousExperience
      : "";
    state.filters.experience = elements.experienceInput.value;
  } catch (error) {
    console.error("Unable to load filter options:", error);
    showNotification("Unable to update role and experience options.", true);
  }
}

/* Location facets: expose clean city/country choices, not full street addresses. */
function normalizeLocationName(value) {
  const name = String(value || "").trim();
  const aliases = {
    bangalore: "Bengaluru",
    bengaluru: "Bengaluru",
    bombay: "Mumbai",
    mumbai: "Mumbai",
    madras: "Chennai",
    chennai: "Chennai",
    calcutta: "Kolkata",
    kolkata: "Kolkata",
    gurgaon: "Gurugram",
    gurugram: "Gurugram",
  };
  return aliases[name.toLowerCase()] || name;
}

function extractLocationOptions(rawLocations) {
  const options = new Map();
  const countries = new Map([
    ["india", "India"],
    ["united states", "United States"],
    ["usa", "United States"],
    ["united kingdom", "United Kingdom"],
    ["uk", "United Kingdom"],
    ["canada", "Canada"],
    ["australia", "Australia"],
    ["germany", "Germany"],
    ["singapore", "Singapore"],
    ["uae", "United Arab Emirates"],
    ["united arab emirates", "United Arab Emirates"],
  ]);
  const states = new Set([
    "andhra pradesh",
    "arunachal pradesh",
    "assam",
    "bihar",
    "chhattisgarh",
    "goa",
    "gujarat",
    "haryana",
    "himachal pradesh",
    "jharkhand",
    "karnataka",
    "kerala",
    "madhya pradesh",
    "maharashtra",
    "manipur",
    "meghalaya",
    "mizoram",
    "nagaland",
    "odisha",
    "punjab",
    "rajasthan",
    "sikkim",
    "tamil nadu",
    "telangana",
    "tripura",
    "uttar pradesh",
    "uttarakhand",
    "west bengal",
    "jammu and kashmir",
    "delhi nct",
  ]);
  const addressTerms =
    /\b(street|road|lane|floor|building|tower|plot|block|sector|phase|unit|avenue|highway|pincode|pin code|cross road)\b/i;
  const adminCodes =
    /^(IN|US|UK|KA|TN|MH|TS|AP|KL|GJ|DL|HR|UP|WB|OH|CA|NY|TX)$/i;

  for (const raw of rawLocations || []) {
    if (typeof raw !== "string" || !raw.trim()) continue;

    // Semicolons usually separate multiple job locations.
    const groups = raw.split(/[;|]/);
    for (const group of groups) {
      const parts = group
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (!parts.length) continue;

      // Country is an independent filter option (e.g. India).
      for (const part of parts) {
        const country = countries.get(part.toLowerCase());
        if (country) options.set(country.toLowerCase(), country);
      }

      // A single clean location such as "India" or "Chennai" is itself useful.
      if (parts.length === 1) {
        const only = parts[0];
        if (!addressTerms.test(only) && !/\d/.test(only)) {
          const normalized = normalizeLocationName(only);
          if (
            !states.has(normalized.toLowerCase()) &&
            !adminCodes.test(normalized)
          ) {
            options.set(normalized.toLowerCase(), normalized);
          }
        }
        continue;
      }

      // For address-like strings, take the first plausible city before state/country.
      // Examples: "CHENNAI, Tamil Nadu, India" and "IN, KA, Bengaluru".
      let city = "";
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (countries.has(lower) || states.has(lower) || adminCodes.test(part))
          continue;
        if (addressTerms.test(part) || /\d/.test(part)) continue;
        if (/^[A-Z]{2,3}$/.test(part)) continue;
        city = normalizeLocationName(part);
        break;
      }

      if (city && city.length >= 2) options.set(city.toLowerCase(), city);
    }
  }

  return [...options.values()].sort((a, b) => a.localeCompare(b));
}

async function loadLocations() {
  try {
    // The endpoint excludes the location filter itself, while retaining source,
    // company, role and other active facets. This prevents a selected city from
    // hiding all other available city/country choices.
    const params = buildFacetParams("location");
    const result = await apiGet(`${API.locations}?${params.toString()}`);
    const rawLocations = Array.isArray(result.data) ? result.data : [];
    state.locations = extractLocationOptions(rawLocations);
    renderLocationOptions();
  } catch (error) {
    console.error("Unable to load locations:", error);
    state.locations = [];
    if (elements.locationOptions) {
      elements.locationOptions.innerHTML =
        '<div class="location-options-message">Unable to load locations. Check the server connection.</div>';
    }
  }
}

function renderLocationOptions() {
  if (!elements.locationInput || !elements.locationOptions) return;

  const currentText = elements.locationInput.value.trim();
  const query = currentText.toLowerCase();
  const selected = currentText
    .split(",")
    .map((value) => normalizeLocationName(value.trim()).toLowerCase())
    .filter(Boolean);

  const available = state.locations.filter((location) => {
    const normalized = normalizeLocationName(location).toLowerCase();
    // When input is a selected token, show other options on focus, and match
    // the typed token when the user is actively searching.
    return (
      !selected.includes(normalized) && (!query || normalized.includes(query))
    );
  });

  if (!available.length) {
    // Empty text means show all choices; do not leave a misleading message
    // just because a previously selected value is still in the input.
    elements.locationOptions.innerHTML = query
      ? '<div class="location-options-message">No matching locations found.</div>'
      : "";
    return;
  }

  elements.locationOptions.innerHTML = available
    .map(
      (location) => `
        <button type="button" class="location-option" role="option"
            data-location="${escapeHTML(location)}">${escapeHTML(location)}</button>
    `,
    )
    .join("");
}

async function loadCompanyOptions() {
  if (!elements.companyOptions) return;
  try {
    const result = await apiGet(API.careerSources);
    // Show every configured official company source; verification status is separate from UI visibility.
    state.careerSources = Array.isArray(result.data) ? result.data : [];
    renderCompanySidebar();
    syncSourceFilter();
  } catch (error) {
    console.error("Unable to load company career sources:", error);
    elements.companyOptions.innerHTML =
      '<div class="location-options-message">Unable to load company career sources.</div>';
  }
}

async function loadCompanyFilterOptions() {
  if (!elements.companyInput) return;
  const previous = elements.companyInput.value;
  try {
    const result = await apiGet(
      `${API.companies}?${buildFacetParams("company").toString()}`,
    );
    const companies = Array.isArray(result.data)
      ? result.data
          .map((item) => String(item.name || "").trim())
          .filter(Boolean)
      : [];
    elements.companyInput.innerHTML =
      '<option value="">Select company</option>' +
      companies
        .map(
          (name) =>
            `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`,
        )
        .join("");
    elements.companyInput.value = companies.includes(previous) ? previous : "";
  } catch (error) {
    console.error("Unable to load company filter options:", error);
  }
}

function openLocationOptions() {
  renderLocationOptions();

  elements.locationOptions.hidden = false;
  elements.locationInput.setAttribute("aria-expanded", "true");
  elements.locationDropdownToggle.setAttribute("aria-expanded", "true");
}

function closeLocationOptions() {
  elements.locationOptions.hidden = true;
  elements.locationInput.setAttribute("aria-expanded", "false");
  elements.locationDropdownToggle.setAttribute("aria-expanded", "false");
}
function applyFilters() {
  state.filters.role = elements.searchInput.value.trim();
  state.filters.location = elements.locationInput.value.trim();
  state.filters.experience = elements.experienceInput.value.trim();
  state.filters.company = elements.companyInput.value.trim();
  state.filters.skills = elements.skillsInput.value.trim();
  state.filters.posted_after = elements.postedDateInput.value;
  state.filters.status = elements.statusFilter.value;
  const salaryBand = elements.salaryFilterInput
    ? elements.salaryFilterInput.value
    : "";
  const salaryParts = salaryBand ? salaryBand.split("-") : [];
  state.filters.salary_min = salaryParts[0] || "";
  state.filters.salary_max = salaryParts.length > 1 ? salaryParts[1] : "";
  state.filters.salary_currency = "INR";
  state.filters.salary_period = "year";

  syncSourceFilter();
  renderSourceOptions();

  state.page = 1;
  state.excludedJobs.clear();

  closeLocationOptions();
  loadJobs();
}

function clearFilters() {
  elements.filterForm.reset();
  if (elements.salaryFilterInput) elements.salaryFilterInput.value = "";
  closeLocationOptions();

  state.filters = {
    role: "",
    location: "",
    experience: "",
    source_id: "",
    source_ids: getSelectedSourceIds().join(","),
    company: "",
    skills: "",
    posted_after: "",
    status: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "INR",
    salary_period: "",
  };
  state.selectedCompanyNames.clear();
  state.page = 1;
  state.excludedJobs.clear();
  state.sortBy = "id";
  state.sortDirection = "desc";

  syncSourceFilter();

  Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]).then(() => loadJobs());
}

function setPage(page) {
  if (page < 1 || page > state.totalPages || page === state.page) {
    return;
  }

  state.page = page;
  loadJobs();
}
function renderCompanySidebar() {
  if (!elements.companyOptions) return;
  const matchingSources = state.careerSources || [];
  // Only show companies whose collectors are currently working. Keep other
  // catalog entries available to the backend without exposing them in the UI.
  const allowedLabels = new Map([
    ["amazon", "Amazon"],
    ["deloitte", "Deloitte"],
    ["deloitte india", "Deloitte"],
    ["cognizant", "Cognizant"],
    ["infosys", "Infosys"],
  ]);
  // Consolidate duplicate legacy source rows by company name and keep the row
  // with the highest job count, so each approved company appears once.
  const byCompany = new Map();
  for (const source of matchingSources) {
    const rawLabel = String(source.company || source.name || "")
      .replace(/ Careers$| Jobs$/i, "")
      .trim();
    const canonicalLabel = allowedLabels.get(rawLabel.toLowerCase());
    if (!canonicalLabel) continue;
    const normalizedSource = { ...source, company: canonicalLabel };
    const key = canonicalLabel.toLowerCase();
    const existing = byCompany.get(key);
    if (
      !existing ||
      (Number(source.job_count) || 0) > (Number(existing.job_count) || 0)
    ) {
      byCompany.set(key, normalizedSource);
    }
  }
  const sources = [...byCompany.values()].sort((a, b) =>
    String(a.company || a.name).localeCompare(String(b.company || b.name)),
  );
  state.visibleCareerSources = sources;
  elements.companyOptions.innerHTML =
    `<label class="source-checkbox-item source-select-all-item"><input type="checkbox" data-select-all-companies><span class="source-label">Select all</span></label>` +
    (sources
      .map((source) => {
        const id = Number(source.id);
        const checked = state.selectedCareerSourceIds.has(id) ? "checked" : "";
        const count = (Number(source.job_count) || 0).toLocaleString("en-IN");
        const label = String(source.company || source.name || "").replace(
          / Careers$| Jobs$/i,
          "",
        );
        return `<label class="source-checkbox-item company-checkbox-item" title="${escapeHTML(label)} job count">
            <input type="checkbox" data-career-source-id="${id}" ${checked}>
            <span class="source-label">${escapeHTML(label)}</span>
            <span class="source-count">${count}</span>
        </label>`;
      })
      .join("") ||
      '<div class="location-options-message">No working company sources configured yet.</div>');
  const master = elements.companyOptions.querySelector(
    "[data-select-all-companies]",
  );
  syncMasterCheckbox(
    master,
    state.selectedCareerSourceIds.size,
    sources.length,
  );
}

/* Page navigation: Companies is a filter group, not a separate career page. */
function showPage(pageName) {
  const dashboard = pageName === "dashboard";
  const reports = pageName === "reports";
  const userRole = document.body.dataset.userRole || "admin";
  const userDashboard = dashboard && userRole === "user";
  if (elements.dashboardPage)
    elements.dashboardPage.hidden = !dashboard || userDashboard;
  const userDashboardPage = document.getElementById("userDashboardPage");
  if (userDashboardPage) userDashboardPage.hidden = !userDashboard;
  elements.jobsPage.hidden = dashboard || reports;
  if (elements.reportsPage) elements.reportsPage.hidden = !reports;
  elements.pageTitle.textContent = dashboard
    ? "Dashboard"
    : reports
      ? "Reports"
      : "Job Opportunities";
  document
    .querySelectorAll(".sidebar-nav > .nav-item[data-page]")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.page === pageName),
    );
  if (elements.jobPortalToggle)
    elements.jobPortalToggle.classList.toggle(
      "active",
      pageName === "jobs" &&
        !elements.companiesToggle?.classList.contains("active"),
    );
  if (elements.companiesToggle)
    elements.companiesToggle.classList.toggle(
      "active",
      pageName === "jobs" &&
        elements.companiesToggle.getAttribute("aria-expanded") === "true",
    );
  const breadcrumb = document.querySelector(".breadcrumb");
  if (breadcrumb) breadcrumb.textContent = "";
  if (dashboard && userDashboard) loadUserDashboard();
  else if (dashboard) loadDashboard();
  if (reports) loadDetailedJobsReport();
}

async function loadUserDashboard() {
  const render = (id, rows, empty) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML =
      rows && rows.length
        ? rows
            .map(
              (item) =>
                `<div class="user-insight-row"><span>${escapeHTML(item.label || "—")}</span><strong>${formatMetric(item.total)}</strong></div>`,
            )
            .join("")
        : `<p class="empty-state">${empty}</p>`;
  };
  try {
    const data = await apiGet("/api/user-dashboard");
    document.getElementById("userMetricJobs").textContent = formatMetric(
      data.active_jobs,
    );
    document.getElementById("userMetricRecentJobs").textContent = formatMetric(
      data.jobs_last_24h,
    );
    document.getElementById("userMetricRecentCompanies").textContent =
      formatMetric(data.companies_last_24h);
    document.getElementById("userMetricRecentLocations").textContent =
      formatMetric(data.locations_last_24h);
    render(
      "userLocations",
      data.locations,
      "No locations have new job records in the last 24 hours.",
    );
    render(
      "userCompanies",
      data.companies,
      "No companies have new job records in the last 24 hours.",
    );
    render(
      "userRoles",
      data.roles,
      "No roles have new job records in the last 24 hours.",
    );
    const recentBody = document.getElementById("userRecentJobsBody");
    if (recentBody)
      recentBody.innerHTML =
        data.recent_jobs && data.recent_jobs.length
          ? data.recent_jobs
              .map(
                (job) =>
                  `<tr><td>${escapeHTML(job.title || "—")}</td><td>${escapeHTML(job.company || "—")}</td><td>${escapeHTML(job.location || "—")}</td><td>${escapeHTML(formatTimestamp(job.created_at))}</td></tr>`,
              )
              .join("")
          : '<tr><td colspan="4" class="empty-state">No jobs were added in the last 24 hours.</td></tr>';
  } catch (error) {
    [
      "userLocations",
      "userCompanies",
      "userRoles",
      "userRecentJobsBody",
    ].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = "Unable to load insights.";
    });
  }
}

function formatMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-IN") : "0";
}
function formatTimestamp(value) {
  if (!value) return "Never";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}
function renderJobsTrend(series) {
  const chart = document.getElementById("jobsTrendChart");
  if (!chart) return;
  if (!series.length) {
    chart.innerHTML = '<p class="empty-state">No trend data available.</p>';
    return;
  }
  const max = Math.max(1, ...series.map((item) => Number(item.count) || 0));
  chart.innerHTML = `<div class="trend-bars">${series
    .map((item) => {
      const count = Math.max(0, Number(item.count) || 0);
      const height = Math.max(count ? 5 : 2, Math.round((count / max) * 100));
      const date = new Date(`${item.date}T12:00:00`);
      const label = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      return `<div class="trend-day" title="${escapeHTML(label)}: ${count} jobs"><div class="trend-bar-track"><span class="trend-bar" style="height:${height}%"></span></div><strong>${count}</strong><small>${escapeHTML(label)}</small></div>`;
    })
    .join("")}</div>`;
}

async function loadDashboard() {
  try {
    const [result, trendResult] = await Promise.all([
      apiGet(API.dashboard),
      apiGet("/api/dashboard/trend"),
    ]);
    renderJobsTrend(Array.isArray(trendResult.data) ? trendResult.data : []);
    const m = result.metrics || {};
    const map = {
      metricJobsToday: m.jobs_added_today,
      metricTotalJobs: m.total_jobs,
      metricEnabledSources: m.enabled_sources,
      metricFailedToday: m.failed_runs_today,
    };
    Object.entries(map).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = formatMetric(value);
    });
    const runsBody = document.getElementById("dashboardRunsBody");
    const runs = Array.isArray(result.recent_runs) ? result.recent_runs : [];
    runsBody.innerHTML = runs.length
      ? runs
          .map(
            (run) =>
              `<tr><td>${escapeHTML(run.source_name || "Unknown")}</td><td>${escapeHTML(formatTimestamp(run.started_at))}</td><td>${escapeHTML(run.status || "unknown")}</td><td>${formatMetric(run.records_found)}</td><td>${formatMetric(run.records_inserted)}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5" class="empty-state">No collection runs recorded yet.</td></tr>';
  } catch (error) {
    console.error("Unable to load dashboard metrics:", error);
    [
      "metricJobsToday",
      "metricTotalJobs",
      "metricEnabledSources",
      "metricFailedToday",
    ].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = "—";
    });
    showNotification(
      "Dashboard metrics could not be loaded. Check database migration and server logs.",
      true,
    );
  }
}

/* Professional, database-backed scraper report. */
const detailedReportState = {
  page: 1,
  perPage: 20,
  totalPages: 1,
  filtersApplied: false,
};

function reportFilterValues() {
  return {
    keyword: document.getElementById("reportKeyword")?.value.trim() || "",
    source_id: document.getElementById("reportSource")?.value.trim() || "",
    company: document.getElementById("reportCompany")?.value.trim() || "",
    location: document.getElementById("reportLocation")?.value.trim() || "",
    posted_from: document.getElementById("reportPostedFrom")?.value || "",
    posted_to: document.getElementById("reportPostedTo")?.value || "",
  };
}

function reportQueryParams(forExport = false) {
  const filters = reportFilterValues();
  const params = new URLSearchParams();
  if (forExport) {
    if (filters.keyword) params.set("search", filters.keyword);
    if (filters.source_id) params.set("source_id", filters.source_id);
    if (filters.company) params.set("company", filters.company);
    if (filters.location) params.set("location", filters.location);
    if (filters.posted_from) params.set("posted_after", filters.posted_from);
    if (filters.posted_to) params.set("posted_before", filters.posted_to);
  } else {
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.source_id) params.set("source_id", filters.source_id);
    if (filters.company) params.set("company", filters.company);
    if (filters.location) params.set("location", filters.location);
    if (filters.posted_from) params.set("posted_from", filters.posted_from);
    if (filters.posted_to) params.set("posted_to", filters.posted_to);
    params.set("page", String(detailedReportState.page));
    params.set("per_page", String(detailedReportState.perPage));
    params.set(
      "sort",
      document.getElementById("reportSort")?.value || "posted_date_desc",
    );
  }
  return params;
}

async function loadDetailedJobsReport() {
  const body = document.getElementById("reportTableBody");
  const summary = document.getElementById("reportResultSummary");
  const pageSummary = document.getElementById("reportPageSummary");
  if (!body) return;
  const params = reportQueryParams(false);
  body.innerHTML =
    '<tr><td colspan="9" class="empty-state">Loading report…</td></tr>';
  try {
    const result = await apiGet(`/api/reports/jobs?${params.toString()}`);
    const jobs = Array.isArray(result.data) ? result.data : [];
    const pagination = result.pagination || {};
    detailedReportState.totalPages = Math.max(
      1,
      Number(pagination.total_pages) || 1,
    );
    if (summary)
      summary.textContent = `${Number(pagination.total || 0).toLocaleString("en-IN")} matching jobs`;
    if (pageSummary)
      pageSummary.textContent = `Page ${pagination.page || 1} of ${detailedReportState.totalPages}`;
    const previous = document.getElementById("reportPreviousPage");
    const next = document.getElementById("reportNextPage");
    if (previous) previous.disabled = detailedReportState.page <= 1;
    if (next)
      next.disabled =
        detailedReportState.page >= detailedReportState.totalPages;
    body.innerHTML = jobs.length
      ? jobs
          .map((job, index) => {
            const salary =
              job.salary_min != null || job.salary_max != null
                ? `${job.salary_min ?? "—"} – ${job.salary_max ?? "—"} ${job.salary_currency || ""} ${job.salary_period || ""}`.trim()
                : "—";
            return `<tr>
                <td>${(detailedReportState.page - 1) * detailedReportState.perPage + index + 1}</td>
                <td>${escapeHTML(job.title || "—")}</td><td>${escapeHTML(job.company || "—")}</td>
                <td>${escapeHTML(job.location || "—")}</td><td>${escapeHTML(job.experience || "—")}</td>
                <td>${escapeHTML(salary)}</td><td><span class="report-source-pill">${escapeHTML(job.source_name || "—")}</span></td>
                <td>${escapeHTML(job.posted_at || "—")}</td>
                <td>${job.job_url && /^https?:\/\//i.test(job.job_url) ? `<a class="table-action report-open-link" href="${escapeHTML(job.job_url)}" target="_blank" rel="noopener noreferrer">Open</a>` : "—"}</td>
            </tr>`;
          })
          .join("")
      : '<tr><td colspan="9" class="empty-state">No jobs match these filters.</td></tr>';
  } catch (error) {
    console.error("Unable to load detailed Jobs report:", error);
    body.innerHTML =
      '<tr><td colspan="9" class="empty-state">Unable to load report. Check the Flask server and database connection.</td></tr>';
    if (summary) summary.textContent = "Report unavailable";
    showNotification("Unable to load the Jobs report.", true);
  }
}

async function loadReportOverview() {
  try {
    const [dashboard, portalResult, runResult] = await Promise.all([
      apiGet(API.dashboard),
      apiGet(API.sources),
      apiGet("/api/collection-runs?limit=8"),
    ]);
    const metrics = dashboard.metrics || {};
    const visiblePortalNames = new Set([
      "foundit",
      "glassdoor",
      "indeed",
      "internshala",
      "naukri",
      "timesjobs",
      "wellfound",
    ]);
    const visiblePortals = (
      Array.isArray(portalResult.data) ? portalResult.data : []
    ).filter((source) =>
      visiblePortalNames.has(
        String(source.name || "")
          .trim()
          .toLowerCase(),
      ),
    );
    const sourceCount = visiblePortals.length;
    const metricValues = {
      reportMetricTotalJobs: metrics.total_jobs,
      reportMetricAddedToday: metrics.jobs_added_today,
      reportMetricSources: sourceCount,
      reportMetricFailures: metrics.failed_runs_today,
    };
    Object.entries(metricValues).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = formatMetric(value);
    });
    const sourceSelect = document.getElementById("reportSource");
    if (sourceSelect) {
      const current = sourceSelect.value;
      const sources = visiblePortals
        .filter((source) => source && source.id != null)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      sourceSelect.innerHTML =
        '<option value="">All sources</option>' +
        sources
          .map(
            (source) =>
              `<option value="${Number(source.id)}">${escapeHTML(source.name)}</option>`,
          )
          .join("");
      if (sources.some((source) => String(source.id) === current))
        sourceSelect.value = current;
    }
    const runs = Array.isArray(runResult.data) ? runResult.data : [];
    const activityBody = document.getElementById("reportActivityBody");
    if (activityBody)
      activityBody.innerHTML = runs.length
        ? runs
            .map((run) => {
              const status = String(run.status || "unknown").toLowerCase();
              const message = run.error_message
                ? String(run.error_message)
                : "—";
              return `<tr><td>${escapeHTML(run.source_name || "Unknown")}</td><td>${escapeHTML(formatTimestamp(run.started_at))}</td><td><span class="run-status run-status-${escapeHTML(status.replace(/[^a-z0-9_-]/g, ""))}">${escapeHTML(run.status || "Unknown")}</span></td><td>${formatMetric(run.records_found)}</td><td>${formatMetric(run.records_inserted)}</td><td>${formatMetric(run.records_updated)}</td><td class="report-error-cell" title="${escapeHTML(message)}">${escapeHTML(message)}</td></tr>`;
            })
            .join("")
        : '<tr><td colspan="7" class="empty-state">No collection runs have been recorded yet.</td></tr>';
  } catch (error) {
    console.error("Unable to load report overview:", error);
    showNotification("Some report summary data could not be loaded.", true);
  }
}

async function downloadReport(format) {
  try {
    const params = reportQueryParams(true);
    params.set("format", format);
    const response = await fetch(`/api/jobs/export?${params.toString()}`);
    if (!response.ok) {
      let message = "Unable to export this report.";
      try {
        message = (await response.json()).error || message;
      } catch {
        /* use fallback */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      format === "csv"
        ? "v4career_scraper_report.csv"
        : "v4career_scraper_report.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotification(`${format.toUpperCase()} report downloaded.`);
  } catch (error) {
    showNotification(error.message || "Report export failed.", true);
  }
}

function initializeDetailedJobsReport() {
  const apply = document.getElementById("applyReportFilters");
  const reset = document.getElementById("resetReportFilters");
  const pageSize = document.getElementById("reportPageSize");
  const sort = document.getElementById("reportSort");
  const previous = document.getElementById("reportPreviousPage");
  const next = document.getElementById("reportNextPage");
  const refresh = document.getElementById("refreshReportsButton");
  if (apply && !apply.dataset.bound)
    apply.addEventListener("click", () => {
      detailedReportState.page = 1;
      detailedReportState.filtersApplied = true;
      loadDetailedJobsReport();
    });
  if (reset && !reset.dataset.bound)
    reset.addEventListener("click", () => {
      document
        .querySelectorAll("#reportFilters input, #reportFilters select")
        .forEach((node) => {
          node.value = "";
        });
      if (sort) sort.value = "posted_date_desc";
      detailedReportState.page = 1;
      detailedReportState.filtersApplied = false;
      loadDetailedJobsReport();
    });
  if (pageSize && !pageSize.dataset.bound)
    pageSize.addEventListener("change", () => {
      detailedReportState.perPage = Number(pageSize.value) || 20;
      detailedReportState.page = 1;
      loadDetailedJobsReport();
    });
  if (sort && !sort.dataset.bound)
    sort.addEventListener("change", () => {
      detailedReportState.page = 1;
      loadDetailedJobsReport();
    });
  if (previous && !previous.dataset.bound)
    previous.addEventListener("click", () => {
      if (detailedReportState.page > 1) {
        detailedReportState.page--;
        loadDetailedJobsReport();
      }
    });
  if (next && !next.dataset.bound)
    next.addEventListener("click", () => {
      if (detailedReportState.page < detailedReportState.totalPages) {
        detailedReportState.page++;
        loadDetailedJobsReport();
      }
    });
  if (refresh && !refresh.dataset.bound)
    refresh.addEventListener("click", async () => {
      await Promise.all([loadReportOverview(), loadDetailedJobsReport()]);
    });
  const excel = document.getElementById("reportExcelButton");
  const csv = document.getElementById("reportCsvButton");
  if (excel && !excel.dataset.bound)
    excel.addEventListener("click", () => downloadReport("xlsx"));
  if (csv && !csv.dataset.bound)
    csv.addEventListener("click", () => downloadReport("csv"));
  loadReportOverview();
  loadDetailedJobsReport();
}

document.addEventListener("DOMContentLoaded", initializeDetailedJobsReport, {
  once: true,
});

/* Table sorting. */
function sortJobs(key) {
  if (state.sortBy === key) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = key;
    state.sortDirection = key === "id" ? "desc" : "asc";
  }

  state.jobs.sort((a, b) => {
    const first = a[state.sortBy] ?? "";
    const second = b[state.sortBy] ?? "";

    const comparison = String(first).localeCompare(String(second), undefined, {
      numeric: true,
      sensitivity: "base",
    });

    return state.sortDirection === "asc" ? comparison : -comparison;
  });

  renderJobs();
}

/* Checked rows are excluded from the Excel export. */
function handleJobSelection(event) {
  const checkbox = event.target.closest(".job-checkbox");

  if (!checkbox) return;

  const id = Number(checkbox.dataset.jobId);

  if (!Number.isSafeInteger(id)) return;

  if (checkbox.checked) {
    state.excludedJobs.add(id);
  } else {
    state.excludedJobs.delete(id);
  }

  updateSelectionCheckbox();
}

function selectVisibleJobs(checked) {
  state.jobs.forEach((job) => {
    const id = Number(job.id);

    if (!Number.isSafeInteger(id)) return;

    if (checked) {
      state.excludedJobs.add(id);
    } else {
      state.excludedJobs.delete(id);
    }
  });

  renderJobs();
}
/* Excel export */
async function exportJobs() {
  try {
    const params = new URLSearchParams();

    params.set("source_ids", state.filters.source_ids);
    state.selectedCompanyNames.forEach((name) =>
      params.append("companies", name),
    );

    for (const [key, value] of Object.entries(state.filters)) {
      if (value !== "" && key !== "source_ids") {
        params.set(key, value);
      }
    }

    if (state.excludedJobs.size) {
      params.set("exclude_job_ids", [...state.excludedJobs].join(","));
    }

    const response = await fetch(`/api/jobs/export?${params.toString()}`);

    if (!response.ok) {
      let message = "Unable to export job listings.";

      try {
        const result = await response.json();
        message = result.error || message;
      } catch {
        // Keep the default error message.
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "v4career_job_listings.xlsx";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);

    showNotification("Excel file downloaded successfully.");
  } catch (error) {
    console.error("Excel export failed:", error);
    showNotification(error.message, true);
  }
}

/* Logout and health check */
async function logout() {
  try {
    await fetch("/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
  }
}

function checkHealth() {
  fetch(API.health)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Health check failed");
      }

      return response.json();
    })
    .then((result) => {
      if (result.status !== "healthy") {
        showNotification("Database connection is unavailable.", true);
      }
    })
    .catch(() => {
      showNotification("Cannot reach the Flask server.", true);
    });
}

/* Form submission */
elements.filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
});

/* Scraper website checkbox selection */
elements.sourceOptions.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("input[data-source-id]");

  if (!checkbox) return;

  const id = Number(checkbox.dataset.sourceId);

  if (checkbox.checked) {
    state.selectedSourceIds.add(id);
  } else {
    state.selectedSourceIds.delete(id);
  }

  syncSourceFilter();

  state.page = 1;
  state.excludedJobs.clear();

  // Keep experience if it exists in the newly selected portal set.
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

/* Location dropdown */
elements.locationDropdownToggle.addEventListener("click", () => {
  if (elements.locationOptions.hidden) {
    openLocationOptions();
    elements.locationInput.focus();
  } else {
    closeLocationOptions();
  }
});

elements.locationInput.addEventListener("focus", openLocationOptions);
elements.locationInput.addEventListener("input", openLocationOptions);

elements.locationOptions.addEventListener("click", async (event) => {
  const option = event.target.closest("[data-location]");

  if (!option) return;

  const picked = option.dataset.location;

  const current = elements.locationInput.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!current.some((value) => value.toLowerCase() === picked.toLowerCase())) {
    current.push(picked);
  }

  elements.locationInput.value = current.join(", ");

  state.filters.location = elements.locationInput.value;
  // Keep the selected experience; loadFilterOptions will retain it when valid
  // and clear it only if the new role/location has no matching records.
  state.page = 1;

  closeLocationOptions();

  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();

  elements.locationInput.focus();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".location-filter-field")) {
    closeLocationOptions();
  }
});

elements.locationInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLocationOptions();
  }

  if (event.key === "Enter") {
    event.preventDefault();
    applyFilters();
  }
});

/* Update experience options when role changes */
elements.searchInput.addEventListener("change", async () => {
  state.filters.role = elements.searchInput.value.trim();
  // Do not discard experience on role changes unless it becomes unavailable.
  state.page = 1;

  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

/* Update experience options when location is edited */
elements.locationInput.addEventListener("change", async () => {
  state.filters.location = elements.locationInput.value.trim();
  // Do not discard experience on location changes unless it becomes unavailable.
  state.page = 1;

  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

/* Update dependent filters when experience changes */
elements.experienceInput.addEventListener("change", async () => {
  state.filters.experience = elements.experienceInput.value.trim();
  state.page = 1;
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

elements.companyInput.addEventListener("change", async () => {
  state.filters.company = elements.companyInput.value.trim();
  state.page = 1;
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

elements.postedDateInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

document
  .getElementById("refreshUserDashboard")
  ?.addEventListener("click", loadUserDashboard);

elements.salaryFilterInput.addEventListener("change", async () => {
  state.page = 1;
  await applyFilters();
});

/* Clear filters */
document.getElementById("clearFilters").addEventListener("click", clearFilters);

/* Expand and collapse additional filters */
elements.moreFiltersToggle.addEventListener("click", () => {
  const isExpanded =
    elements.moreFiltersToggle.getAttribute("aria-expanded") === "true";

  elements.moreFilters.hidden = isExpanded;

  elements.moreFiltersToggle.setAttribute("aria-expanded", String(!isExpanded));

  elements.moreFiltersToggle.textContent = isExpanded
    ? "+ More filters"
    : "− Fewer filters";
});

/* Expand and collapse scraper websites */
elements.jobPortalToggle.addEventListener("click", () => {
  showPage("jobs");
  const expanded =
    elements.jobPortalToggle.getAttribute("aria-expanded") === "true";
  elements.jobPortalToggle.setAttribute("aria-expanded", String(!expanded));
  elements.sourceMenu.hidden = expanded;
  const portalGlyph = document.getElementById("dropdownArrow");
  if (portalGlyph) portalGlyph.textContent = expanded ? "+" : "−";
});
/* Pagination and page size */
elements.pageSizeSelect.addEventListener("change", () => {
  state.perPage = Number(elements.pageSizeSelect.value) || 10;
  state.page = 1;

  loadJobs();
});
/* Company Career Sites are scraper sources, never company-name filters. */
if (elements.companiesToggle && elements.companyOptions) {
  elements.companiesToggle.addEventListener("click", async () => {
    const expanded =
      elements.companiesToggle.getAttribute("aria-expanded") === "true";
    elements.companiesToggle.setAttribute("aria-expanded", String(!expanded));
    elements.companyOptions.hidden = expanded;
    showPage("jobs");
    elements.jobPortalToggle.classList.remove("active");
    document
      .querySelectorAll(".sidebar-nav > .nav-item[data-page]")
      .forEach((item) => item.classList.remove("active"));
    elements.companiesToggle.classList.add("active");
    const glyph = document.getElementById("companiesArrow");
    if (glyph) glyph.textContent = expanded ? "+" : "−";
    if (!expanded) await loadCompanyOptions();
  });
  elements.companyOptions.addEventListener("change", async (event) => {
    const checkbox = event.target.closest("input[data-career-source-id]");
    if (!checkbox) return;
    const id = Number(checkbox.dataset.careerSourceId);
    if (checkbox.checked) {
      state.selectedCareerSourceIds.add(id);
      // Choosing a company from the Dashboard sidebar should open Job Portal.
      showPage("jobs");
    } else {
      state.selectedCareerSourceIds.delete(id);
    }
    syncMasterCheckbox(
      elements.selectAllCareerSites,
      state.selectedCareerSourceIds.size,
      (state.visibleCareerSources || state.careerSources).length,
    );
    syncSourceFilter();
    state.page = 1;
    state.excludedJobs.clear();
    await Promise.all([
      loadFilterOptions(),
      loadCompanyFilterOptions(),
      loadSalaryFilterOptions(),
    ]);
    await loadJobs();
  });
}

elements.sourceOptions.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-select-all-portals]")) return;
  state.selectedSourceIds = event.target.checked
    ? new Set(state.sources.map((source) => Number(source.id)))
    : new Set();
  renderSourceOptions();
  syncSourceFilter();
  state.page = 1;
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});
elements.companyOptions.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-select-all-companies]")) return;
  state.selectedCareerSourceIds = event.target.checked
    ? new Set(
        (state.visibleCareerSources || state.careerSources || []).map(
          (source) => Number(source.id),
        ),
      )
    : new Set();
  renderCompanySidebar();
  syncSourceFilter();
  state.page = 1;
  state.excludedJobs.clear();
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();
});

elements.jobsTableBody.addEventListener("click", (event) => {
  const titleButton = event.target.closest("[data-job-details-id]");
  if (titleButton) showJobDetails(titleButton.dataset.jobDetailsId);
});

document
  .getElementById("jobDetailsClose")
  .addEventListener("click", closeJobDetails);
document
  .getElementById("jobDetailsExport")
  .addEventListener("click", exportJobDetails);
document
  .getElementById("jobDetailsModal")
  .addEventListener("click", (event) => {
    if (event.target.matches("[data-close-job-details]")) closeJobDetails();
  });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeJobDetails();
});

elements.jobsTableBody.addEventListener("change", handleJobSelection);

elements.selectAllJobs.addEventListener("change", (event) => {
  selectVisibleJobs(event.target.checked);
});

/* Sort table columns */
document
  .querySelector(".jobs-table thead")
  .addEventListener("click", (event) => {
    const header = event.target.closest("th[data-sort]");

    if (header) {
      sortJobs(header.dataset.sort);
    }
  });

/* Pagination buttons */
document
  .getElementById("firstPageButton")
  .addEventListener("click", () => setPage(1));

document
  .getElementById("previousPageButton")
  .addEventListener("click", () => setPage(state.page - 1));

document
  .getElementById("nextPageButton")
  .addEventListener("click", () => setPage(state.page + 1));

document
  .getElementById("lastPageButton")
  .addEventListener("click", () => setPage(state.totalPages));

/* Refresh dashboard data */
const refreshDashboardButton = document.getElementById(
  "refreshDashboardButton",
);
if (refreshDashboardButton)
  refreshDashboardButton.addEventListener("click", loadDashboard);
document.getElementById("refreshButton").addEventListener("click", async () => {
  await loadSources();
  await Promise.all([
    loadFilterOptions(),
    loadCompanyFilterOptions(),
    loadSalaryFilterOptions(),
  ]);
  await loadJobs();

  checkHealth();
});

/* Export button */
document.getElementById("exportButton").addEventListener("click", exportJobs);

/* Logout button */
document.getElementById("logoutButton").addEventListener("click", logout);

/* Sidebar navigation */
document
  .querySelectorAll(".sidebar-nav > .nav-item[data-page]")
  .forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();

      showPage(item.dataset.page);

      elements.sidebar.classList.remove("open");
    });
  });

/* Animated sidebar collapse on desktop; slide-in navigation on mobile. */
const sidebarMenuButton = document.getElementById("mobileMenuButton");
sidebarMenuButton.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 760px)").matches) {
    elements.sidebar.classList.toggle("open");
    const isOpen = elements.sidebar.classList.contains("open");
    sidebarMenuButton.setAttribute("aria-expanded", String(isOpen));
    sidebarMenuButton.title = isOpen ? "Close navigation" : "Open navigation";
    return;
  }
  const collapsed = document
    .querySelector(".app-layout")
    .classList.toggle("sidebar-collapsed");
  sidebarMenuButton.setAttribute("aria-expanded", String(!collapsed));
  sidebarMenuButton.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
});

/* Profile avatar reveals the existing logout action on hover or keyboard focus. */
const profileMenu = document.getElementById("profileMenu");
const profileButton = document.getElementById("profileButton");
const profileDropdown = document.getElementById("profileDropdown");
function setProfileMenu(open) {
  profileDropdown.hidden = !open;
  profileButton.setAttribute("aria-expanded", String(open));
}
profileButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setProfileMenu(profileDropdown.hidden);
});
profileMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setProfileMenu(false);
    profileButton.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target)) setProfileMenu(false);
});

/* Initial loading */
async function initializePortal() {
  showPage("dashboard");
  await loadSources();
  await Promise.all([loadFilterOptions(), loadCompanyOptions()]);
  await loadJobs();
  checkHealth();
}

initializePortal();
