"""Known job portals and their public homepages.

A portal appears in V4Career even before it has collected records. Collection
requires a permitted feed/API or an appropriately configured Apify Actor; this
catalog does not claim that every source is already scrape-ready.
"""

JOB_PORTALS = [
    {"name": "Foundit", "base_url": "https://www.foundit.in", "key": "FOUNDIT"},
    {"name": "Glassdoor", "base_url": "https://www.glassdoor.co.in/Job", "key": "GLASSDOOR"},
    {"name": "Indeed", "base_url": "https://in.indeed.com", "key": "INDEED"},
    {"name": "Internshala", "base_url": "https://internshala.com", "key": "INTERNSHALA"},
    {"name": "Naukri", "base_url": "https://www.naukri.com", "key": "NAUKRI"},
    {"name": "TimesJobs", "base_url": "https://www.timesjobs.com", "key": "TIMESJOBS"},
    {"name": "Wellfound", "base_url": "https://wellfound.com", "key": "WELLFOUND"},
]

PORTAL_BY_KEY = {item["key"].lower(): item for item in JOB_PORTALS}
PORTAL_BY_NAME = {item["name"].strip().lower(): item for item in JOB_PORTALS}


# Candidate Actors checked against current Apify Store listings on 2026-10-14.
# These are defaults, not a guarantee of availability or permission.
# Every source still requires APIFY_ACCESS_APPROVED_<KEY>=true before execution.
DEFAULT_APIFY_ACTORS = {
    "NAUKRI": "automation-lab~naukri-scraper",
    "INDEED": "unfenced-group~indeed-in-scraper",
    "FOUNDIT": "deriverge~foundit-jobs-scraper",
    "INTERNSHALA": "automation-lab~internshala-scraper",
    "TIMESJOBS": "unfenced-group~timesjobs-scraper",
    "WELLFOUND": "cprussin~wellfound-jobs",
}
