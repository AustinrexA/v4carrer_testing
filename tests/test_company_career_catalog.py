import unittest
from urllib.parse import urlparse

from collectors.company_career_catalog import COMPANY_CAREER_SOURCES, COMPANY_CAREER_BY_KEY


class CompanyCareerCatalogTests(unittest.TestCase):
    def test_catalog_contains_requested_companies_and_excludes_removed_sources(self):
        expected = {"INFOSYS", "AMAZON", "DELOITTE", "HCLTECH", "COGNIZANT", "CAPGEMINI", "TECHMAHINDRA", "IBM"}
        self.assertEqual({s["key"] for s in COMPANY_CAREER_SOURCES}, expected)
        self.assertEqual(len(COMPANY_CAREER_SOURCES), len(COMPANY_CAREER_BY_KEY))
        self.assertNotIn("WIPRO", COMPANY_CAREER_BY_KEY)
        self.assertNotIn("ACCENTURE", COMPANY_CAREER_BY_KEY)
        self.assertTrue(COMPANY_CAREER_BY_KEY["INFOSYS"]["verified_collector"])
        self.assertTrue(COMPANY_CAREER_BY_KEY["AMAZON"]["verified_collector"])
        self.assertTrue(COMPANY_CAREER_BY_KEY["DELOITTE"]["verified_collector"])

    def test_company_sources_have_https_urls_and_required_fields(self):
        for source in COMPANY_CAREER_SOURCES:
            with self.subTest(source=source["key"]):
                self.assertTrue(source["key"])
                self.assertTrue(source["company"])
                self.assertTrue(source["allowed_hosts"])
                parsed = urlparse(source["base_url"])
                self.assertEqual(parsed.scheme, "https")
                self.assertTrue(parsed.netloc)


if __name__ == "__main__":
    unittest.main()
