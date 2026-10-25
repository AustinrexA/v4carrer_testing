"""Official company career entry points used by V4Career collectors.

A source is shown in the UI when configured; this does not imply its collector
has been live-verified. Only real India-located JobPosting records are saved.
"""
COMPANY_CAREER_SOURCES = [
    {
        "name": "Infosys Careers", "company": "Infosys",
        "base_url": "https://career.infosys.com/jobs?countrycode=IN",
        "key": "INFOSYS", "allowed_hosts": ["career.infosys.com"],
        "discovery_urls": ["https://career.infosys.com/joblist?companyhiringtype=&countrycode=IN"],
        "verified_collector": True,
    },
    {
        "name": "Amazon Jobs", "company": "Amazon",
        "base_url": "https://www.amazon.jobs/en/search?country=IND&loc_query=India",
        "key": "AMAZON", "allowed_hosts": ["www.amazon.jobs", "amazon.jobs"],
        "discovery_urls": ["https://www.amazon.jobs/en/search?country=IND&loc_query=India"],
        "verified_collector": True,
    },
    {
        "name": "Deloitte India Careers", "company": "Deloitte",
        "base_url": "https://southasiacareers.deloitte.com/",
        "key": "DELOITTE", "allowed_hosts": ["southasiacareers.deloitte.com"],
        "discovery_urls": ["https://southasiacareers.deloitte.com/"],
        "verified_collector": True,
    },
    {
        "name": "HCLTech Careers", "company": "HCLTech",
        "base_url": "https://www.hcltech.com/careers/careers-in-india",
        "key": "HCLTECH", "allowed_hosts": ["www.hcltech.com", "hcltech.com"],
        "discovery_urls": ["https://www.hcltech.com/careers/careers-in-india"],
        "verified_collector": False,
    },
    {
        "name": "Cognizant Careers", "company": "Cognizant",
        "base_url": "https://careers.cognizant.com/india-en/",
        "key": "COGNIZANT", "allowed_hosts": ["careers.cognizant.com"],
        "discovery_urls": ["https://careers.cognizant.com/india-en/"],
        "verified_collector": False,
    },
    {
        "name": "Capgemini Careers", "company": "Capgemini",
        "base_url": "https://www.capgemini.com/in-en/careers/",
        "key": "CAPGEMINI", "allowed_hosts": ["www.capgemini.com", "capgemini.com"],
        "discovery_urls": ["https://www.capgemini.com/in-en/careers/"],
        "verified_collector": False,
    },
    {
        "name": "Tech Mahindra Careers", "company": "Tech Mahindra",
        "base_url": "https://www.techmahindra.com/en-in/careers/",
        "key": "TECHMAHINDRA", "allowed_hosts": ["www.techmahindra.com", "techmahindra.com"],
        "discovery_urls": ["https://www.techmahindra.com/en-in/careers/"],
        "verified_collector": False,
    },
    {
        "name": "IBM Careers", "company": "IBM",
        "base_url": "https://www.ibm.com/careers/search",
        "key": "IBM", "allowed_hosts": ["www.ibm.com", "ibm.com"],
        "discovery_urls": ["https://www.ibm.com/careers/search"],
        "verified_collector": False,
    },
]
COMPANY_CAREER_BY_KEY = {item["key"]: item for item in COMPANY_CAREER_SOURCES}
COMPANY_CAREER_BY_NAME = {item["name"].casefold(): item for item in COMPANY_CAREER_SOURCES}
