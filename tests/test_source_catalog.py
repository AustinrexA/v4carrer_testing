import unittest
from urllib.parse import urlparse

from collectors.source_catalog import JOB_PORTALS, PORTAL_BY_KEY


class SourceCatalogTests(unittest.TestCase):
    def test_catalog_has_only_seven_supported_portals(self):
        self.assertEqual(len(JOB_PORTALS), 7)
        self.assertEqual(len({portal["key"] for portal in JOB_PORTALS}), 7)
        self.assertEqual(len({portal["name"].lower() for portal in JOB_PORTALS}), 7)
        self.assertEqual({portal["name"] for portal in JOB_PORTALS}, {"Foundit", "Glassdoor", "Indeed", "Internshala", "Naukri", "TimesJobs", "Wellfound"})

    def test_all_portals_have_valid_https_homepages(self):
        for portal in JOB_PORTALS:
            with self.subTest(portal=portal["name"]):
                parsed = urlparse(portal["base_url"])
                self.assertEqual(parsed.scheme, "https")
                self.assertTrue(parsed.netloc)
                self.assertIn(portal["key"].lower(), PORTAL_BY_KEY)

    def test_requested_sources_are_present(self):
        names = {portal["name"] for portal in JOB_PORTALS}
        self.assertTrue({"Naukri", "Indeed", "Foundit", "Internshala", "TimesJobs", "Wellfound"}.issubset(names))


if __name__ == "__main__":
    unittest.main()
