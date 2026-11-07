import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import hashlib
import json
import shutil
import subprocess
import zipfile

spec = importlib.util.spec_from_file_location("review", Path(__file__).with_name("review.py"))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class ReviewTests(unittest.TestCase):
    def test_provider_secret_is_redacted(self):
        fake = "gh" + "p_" + "A" * 36
        results = review.inspect_text("const credential = '" + fake + "';", "src/config.js")
        self.assertEqual(results[0]["rule"], "provider-token")
        self.assertNotIn(fake, str(results))

    def test_private_key_and_credential_url(self):
        key = "-----BEGIN " + "PRIVATE KEY-----"
        uri = "postgres" + "://demo:synthetic-value@localhost/db"
        self.assertEqual({r["rule"] for r in review.inspect_text(key + "\n" + uri, "x")},
                         {"private-key", "credential-url"})

    def test_personal_paths_cross_platform(self):
        for path in ["/Users/" + "private-person/work", "/home/" + "private-person/work",
                     "C:\\Users\\" + "private-person\\work"]:
            self.assertEqual(review.inspect_text(path, "x")[0]["rule"], "personal-home")

    def test_contacts_and_examples(self):
        private = "reviewer" + "@" + "private.invalid"
        self.assertEqual(review.inspect_text(private, "x")[0]["rule"], "email")
        self.assertEqual(review.inspect_text("demo@example.com", "x"), [])
        phone = "Phone: " + "+1 212 " + "555 0198"
        self.assertEqual(review.inspect_text(phone, "x")[0]["rule"], "phone")

    def test_exception_is_content_bound_and_cannot_hide_secrets(self):
        data = (("ref" + "@" + "private.invalid") + " gh" + "p_" + "B" * 36).encode()
        found = review.inspect_text(data.decode(), "paper.txt")
        exceptions = [{"path": "paper.txt", "blob": review.blob_sha(data),
                       "rules": ["email", "provider-token"], "reason": "published reference"}]
        self.assertEqual([f["rule"] for f in review.apply_exceptions(found, "paper.txt", data, exceptions)],
                         ["provider-token"])
        self.assertEqual(len(review.apply_exceptions(found, "paper.txt", data + b" changed", exceptions)), 2)

    def test_sensitive_file_paths(self):
        for name in [".env", ".env.production", ".npmrc", "id_ed25519", "private.p12"]:
            self.assertTrue(review.inspect_path(name))
        self.assertFalse(review.inspect_path(".env.example"))

    def test_archives_are_scanned_without_extracting(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("../../outside.txt", "gh" + "p_" + "C" * 36)
        findings, _ = review.inspect_data(data.getvalue(), "bundle.zip")
        self.assertEqual(findings[0]["rule"], "provider-token")
        self.assertEqual(findings[0]["path"], "bundle.zip!../../outside.txt")

    def test_corrupt_archive_fails_closed(self):
        findings, _ = review.inspect_data(b"invalid zip", "bundle.zip")
        self.assertEqual(findings[0]["rule"], "archive-unreadable")

    def test_relative_concat_fixture_is_portable(self):
        root = Path(__file__).parents[2]
        for manifest in (root / "scripts/video_pipeline").glob("output*/concat*.txt"):
            for line in manifest.read_text().splitlines():
                if line.startswith("file '"):
                    relative = line[6:-1]
                    self.assertFalse(Path(relative).is_absolute())
                    self.assertTrue((manifest.parent / relative).exists(), str(manifest))

    def test_missing_gitleaks_report_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(review.shutil, "which", return_value="/fake/gitleaks"), \
                    patch.object(review.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
                findings, _ = review.scan_gitleaks(Path(tmp))
            self.assertEqual(findings[0]["rule"], "gitleaks-missing-report")

    def test_real_gitleaks_redaction_without_using_credential(self):
        binary = shutil.which("gitleaks")
        self.assertIsNotNone(binary, "Install the checksum-verified scanner before running these tests")
        fake = "gh" + "p_" + hashlib.sha256(b"synthetic-only-no-service").hexdigest()[:36]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "fixture.txt").write_text(fake)
            report = root / "report.json"
            result = subprocess.run([binary, "dir", str(root), "--redact=100", "--no-banner",
                                     "--report-format=json", "--report-path=" + str(report)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertTrue(json.loads(report.read_text()))
            self.assertNotIn(fake, result.stdout + result.stderr + report.read_text())

    def test_no_raw_contact_in_report(self):
        value = "reviewer" + "@" + "private.invalid"
        self.assertNotIn(value, str(review.inspect_text(value, "fixture")))


if __name__ == "__main__":
    unittest.main()
