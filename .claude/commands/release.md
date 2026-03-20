---
description: Bump version, update release notes, and push a tagged release
user_arg: version bump type (patch, minor, or major) — defaults to patch
---

Create a new release for KolShek. Steps:

1. Read the current version from `package.json`
2. Bump the version based on the argument: "$ARGUMENTS" (default to "patch" if empty)
   - patch: 0.1.4 → 0.1.5
   - minor: 0.1.4 → 0.2.0
   - major: 0.1.4 → 1.0.0
3. Run `git log --oneline` from the last tag to HEAD to see what changed
4. Write the new release notes:
   a. **Replace** `RELEASE_NOTES.md` with ONLY the new version's notes (no previous versions). Group by:
      - **Features** (new functionality)
      - **Bug Fixes** (corrections)
      - **Security** (security improvements) — omit if empty
      - **Other** (refactors, docs, etc.) — omit if empty
      Write concise, user-facing descriptions (not raw commit messages). Skip version bump commits.
   b. **Prepend** the same section to `CHANGELOG.md` — insert it right after the `# Changelog` header, above the previous entries, with a `---` separator between versions.
5. Update the `"version"` field in `package.json`
6. Update the `version` field in all skill and plugin files:
   - `plugin/.claude-plugin/plugin.json`
   - All `plugin/skills/*/SKILL.md` (the `version` field in YAML frontmatter)
7. Regenerate the embedded plugin bundle: `bun scripts/generate-plugin-embed.ts`
   (This updates `src/cli/plugin-files.ts` so the compiled binary includes the new version strings.)
8. Commit all updated files with message: `Bump version to vX.Y.Z`
9. Show me the release notes and new version and ask for confirmation before pushing
10. After confirmation: push the commit, create tag `vX.Y.Z`, push the tag
11. Show the GitHub Actions URL so I can monitor the release workflow
12. After the release workflow completes and binaries are uploaded, generate SHA256 checksum sidecar files:
    - For each binary asset (e.g. `kolshek-windows-x64.exe`, `kolshek-linux-x64`, etc.):
      - Download the asset
      - Generate SHA256: `sha256sum <binary> > <binary>.sha256`
      - Upload the `.sha256` file to the release via `gh release upload vX.Y.Z <binary>.sha256`
    - These checksums are verified by the `kolshek update` command before installing
