#!/usr/bin/env python3
"""Offline, redacted repository/privacy review. Does not validate credentials online."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

LIMIT = 80 * 1024 * 1024
ARCHIVE_LIMIT = 150 * 1024 * 1024
RULES = {
    "provider-token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,})\b"),
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----"),
    "credential-url": re.compile(r"\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^/\s:@]+:[^/\s@]{3,}@"),
    "personal-home": re.compile(r"(?:/(?:Users|home)/(?!runner(?:/|\b)|oai(?:/|\b)|node(?:/|\b)|user(?:/|\b)|username(?:/|\b)|example(?:/|\b))[A-Za-z0-9._-]+|[A-Z]:\\Users\\[^\\\s\"'<>]+)"),
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "phone": re.compile(r"(?:phone|tel(?:ephone)?|mobile|call|whats ?app|电话|手机)[ \t]*[:：]?[ \t\r\n]{0,6}(\+?[\d(][\d(). -]{7,}\d)", re.I),
}
PRIVACY_RULES = {"email", "phone"}
PUBLIC_EXAMPLE_EMAIL = re.compile(r"@(?:example\.(?:com|org|net|invalid)|users\.noreply\.github\.com)$", re.I)


def finding(rule, path, line=1, severity="error"):
    # Deliberately omit matches, snippets, names, addresses, and secret values.
    return {"rule": rule, "path": path, "line": line, "severity": severity}


def inspect_text(text, path):
    findings = []
    for rule, pattern in RULES.items():
        for match in pattern.finditer(text):
            if rule == "email" and PUBLIC_EXAMPLE_EMAIL.search(match.group()):
                continue
            findings.append(finding(rule, path, text.count("\n", 0, match.start()) + 1))
    return findings


def inspect_path(path):
    name = PurePosixPath(path).name.lower()
    if (name == ".env" or (name.startswith(".env.") and name not in {".env.example", ".env.sample", ".env.template"})
            or name in {".npmrc", ".pypirc", "id_rsa", "id_ed25519", "credentials.json", "credentials"}
            or name.endswith((".key", ".p12", ".pfx"))):
        return [finding("credential-file", path)]
    return []


def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def apply_exceptions(findings, path, data, exceptions):
    allowed = set()
    for entry in exceptions:
        if entry.get("path") == path and entry.get("blob") == blob_sha(data) and entry.get("reason"):
            allowed.update(set(entry.get("rules", [])) & PRIVACY_RULES)
    return [f for f in findings if f["rule"] not in allowed]


def inspect_data(data, path, depth=0):
    findings, notes = [], []
    if len(data) > LIMIT:
        return [finding("scan-size-limit", path)], notes
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in {".zip", ".docx"}:
        if depth >= 3:
            return [finding("archive-depth-limit", path)], notes
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = archive.infolist()
                if len(members) > 20000 or sum(m.file_size for m in members) > ARCHIVE_LIMIT:
                    return [finding("archive-size-limit", path)], notes
                for member in members:
                    if member.is_dir():
                        continue
                    # Read in memory. Never extract paths supplied by an archive.
                    virtual_path = path + "!" + member.filename
                    child, child_notes = inspect_data(archive.read(member), virtual_path, depth + 1)
                    findings.extend(child)
                    notes.extend(child_notes)
                    if member.filename == "docProps/core.xml":
                        xml = archive.read(member).decode("utf-8", errors="replace")
                        if re.search(r"<(?:dc:creator|cp:lastModifiedBy)>\s*[^<\s]", xml):
                            notes.append(finding("document-author-metadata", path, severity="review"))
        except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError):
            findings.append(finding("archive-unreadable", path))
    elif suffix == ".pdf":
        if not shutil.which("pdftotext"):
            return [finding("missing-pdf-scanner", path)], notes
        with tempfile.TemporaryDirectory(prefix="sentinel-document-") as tmp:
            pdf = Path(tmp) / "document.pdf"
            pdf.write_bytes(data)
            try:
                result = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True, timeout=90)
                if result.returncode:
                    findings.append(finding("pdf-unreadable", path))
                else:
                    text = result.stdout.decode("utf-8", errors="strict")
                    findings.extend(inspect_text(text, path))
                    if not text.strip():
                        notes.append(finding("image-only-pdf-needs-visual-review", path, severity="review"))
            except (subprocess.TimeoutExpired, UnicodeDecodeError):
                findings.append(finding("pdf-extraction-failed", path))
    else:
        if b"\0" in data:
            return findings, notes
        try:
            findings.extend(inspect_text(data.decode("utf-8-sig"), path))
        except UnicodeDecodeError:
            notes.append(finding("binary-needs-visual-review", path, severity="review"))
    return findings, notes


def git(root, *args):
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=True)
    return result.stdout


def scan_tree(root, exceptions, directory=None):
    findings, notes = [], []
    paths = list(directory.rglob("*")) if directory else [
        root / os.fsdecode(p) for p in git(root, "ls-files", "-z").split(b"\0") if p]
    for file in paths:
        if not file.is_file():
            continue
        path = file.relative_to(root).as_posix()
        if file.is_symlink():
            findings.append(finding("symlink-needs-review", path))
            continue
        try:
            data = file.read_bytes()
            current, current_notes = inspect_data(data, path)
            current += inspect_path(path)
            findings.extend(apply_exceptions(current, path, data, exceptions))
            notes.extend(current_notes)
        except OSError:
            findings.append(finding("file-unreadable", path))
    return findings, notes, len(paths)


def scan_gitleaks(root, directory=None):
    binary = shutil.which("gitleaks")
    if not binary:
        return [finding("missing-gitleaks", "(scanner)")], 0
    findings = []
    with tempfile.TemporaryDirectory(prefix="sentinel-secrets-") as tmp:
        report = Path(tmp) / "results.json"
        args = [binary, "dir" if directory else "git", str(directory or root),
                "--redact=100", "--no-banner", "--log-level=error",
                "--max-archive-depth=3", "--max-decode-depth=3",
                "--report-format=json", "--report-path=" + str(report)]
        if not directory:
            args.append("--log-opts=--all")
        try:
            result = subprocess.run(args, cwd=root, capture_output=True, timeout=900)
            if result.returncode not in (0, 1):
                return [finding("gitleaks-execution-failed", "(scanner)")], 0
            raw = json.loads(report.read_text()) if report.exists() else []
            if result.returncode == 1 and not raw:
                return [finding("gitleaks-missing-report", "(scanner)")], 0
            for entry in raw or []:
                f = finding("gitleaks:" + entry["RuleID"], entry["File"], entry.get("StartLine", 1))
                f["commit"] = entry.get("Commit", "")
                findings.append(f)
        except (subprocess.TimeoutExpired, OSError, ValueError, KeyError):
            findings.append(finding("gitleaks-scan-incomplete", "(scanner)"))
    return findings, len(findings)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", help="Scan generated artifacts instead of tracked files/history")
    parser.add_argument("--report", help="Write a sanitized report; never includes matched values")
    args = parser.parse_args()
    root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel").decode().strip())
    directory = (root / args.directory).resolve() if args.directory else None
    if directory and (not directory.is_dir() or not directory.is_relative_to(root)):
        parser.error("Artifact directory must exist inside the repository")
    exception_path = root / "scripts/security/privacy-exceptions.json"
    exceptions = json.loads(exception_path.read_text()).get("exceptions", [])
    findings, notes, files = scan_tree(root, exceptions, directory)
    secret_findings, _ = scan_gitleaks(root, directory)
    findings.extend(secret_findings)
    metadata = {}
    if not directory:
        emails = git(root, "log", "--all", "--format=%ae%n%ce").decode().splitlines()
        personal = {e.lower() for e in emails if e and not e.endswith(("users.noreply.github.com", "@github.com"))}
        metadata = {"nonAnonymousGitEmailIdentities": len(personal)}
        if personal:
            notes.append(finding("historical-commit-email-metadata", "(git metadata)", severity="review"))
    report = {"files": files, "findings": findings, "reviewNotes": notes, "gitMetadata": metadata}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        Path(args.report).write_text(output + "\n", encoding="utf-8")
    print(output)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
