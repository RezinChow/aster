import unittest

from download_proxy import target


class DownloadBoundaryTests(unittest.TestCase):
    def test_expected_public_download_sources_are_allowed(self):
        self.assertEqual(target('cas-server.xethub.hf.co:443'), ('cas-server.xethub.hf.co', 443))
        self.assertEqual(target('files.pythonhosted.org:443'), ('files.pythonhosted.org', 443))

    def test_arbitrary_hosts_ports_and_suffix_impersonation_are_refused(self):
        for authority in ['127.0.0.1:443', 'huggingface.co:22', 'huggingface.co.evil.invalid:443',
                          'evilhuggingface.co:443', 'user@huggingface.co:443', 'localhost:80']:
            with self.subTest(authority=authority), self.assertRaises(ValueError):
                target(authority)


if __name__ == '__main__':
    unittest.main()
