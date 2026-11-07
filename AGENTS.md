# Repository instructions

## Required for every pull request

Read and apply [.agents/skills/security-review/SKILL.md](.agents/skills/security-review/SKILL.md) before preparing or updating any PR, including documentation, screenshots, generated files, and dependency changes.

- Review current files, the PR diff, reachable Git history, attachments and the actual Pages build for secrets and personal data.
- Run the security check and relevant tests. Fix failures before marking the PR ready or merging. Report exact commands, reviewed commit and any remaining limitations.
- Do not copy suspected credentials or personal contact values into chat, commits, PR text, workflow logs or reports. Report path, line, rule and remediation only.
- Never validate a discovered credential by using it. If a real credential is exposed, remove its current occurrence and arrange provider-side revocation/rotation; deletion alone does not resolve exposure.
- Do not rewrite shared Git history, delete reference material, or change repository/account visibility as an incidental repair.
- Exceptions must be narrow, content-bound and explained. Do not suppress secret rules or baseline real secrets just to pass CI.
- Treat changes to this file, the skill, security workflow/scanner and exception file as security-sensitive and explicitly review them.
- The `security-review` workflow must run for every PR without path exclusions. Repository rulesets should require its successful check; an automated check alone does not configure branch protection.
