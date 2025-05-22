# AI ASSISTANT (Gemini) REMINDERS:
#
# 1. PRE-COMMIT CHECKS:
#    ALWAYS RUN `just check-all` MANUALLY BEFORE COMMITTING ANY CHANGES.
#    This is critical for code quality as the pre-commit hook may not always trigger
#    in your execution environment.
#
# 2. VERSION UPDATES & RELEASES:
#    A. IF A NEW VERSION IS REQUESTED AND THE VERSION NUMBER ISN'T SPECIFIED,
#       ALWAYS ASK THE USER FOR THE NEW VERSION (e.g., vX.Y.Z).
#
#    B. FOR RELEASING A NEW VERSION (updating version numbers, tagging, etc.):
#       - The PREFERRED METHOD is to use the `just release` command (which executes `.release.mjs`).
#       - This script handles:
#         - Prompting for the new version.
#         - Updating version numbers in `manifest.json`, `package.json`, `versions.json`, and `package-lock.json`.
#         - Committing these file changes.
#         - Creating and pushing a Git tag.
#       - ALWAYS VERIFY the contents of these files and the Git history after running the script.
#       - NOTE: Automatic GitHub Release creation (e.g., drafting release notes on GitHub) is NOT currently part of this script.
#
#    C. UPDATE `README.md` MANUALLY after running the release script and verifying file versions:
#       - Update the "Current Version:" line near the top of the README.
#       - Add a new sub-entry under the relevant "Minor Versions of vX.Y.x" section detailing the changes for the new version.
#
#    D. GIT TAGS:
#       - If `just release` creates a Git tag, ensure it's pushed to the remote repository using `git push origin --tags` (the script should handle this).
#       - If a commit is made *after* tagging for a version (e.g., a hotfix for the same version number)
#         and you need to update the tag to point to the new commit (retag):
#         1. `git tag -f vX.Y.Z` (to force update the local tag)
#         2. `git push origin -f --tags` (to force update the remote tag)
#
#    E. FINAL CHECKLIST BEFORE CONCLUDING A RELEASE TASK:
#       - All version numbers in `manifest.json`, `package.json`, `versions.json`, and `README.md` are consistent.
#       - All changes are committed and pushed to the main/feature branch.
#       - The correct Git tag is created locally, pushed to the remote, and points to the final commit for the version.

set quiet := true

test_vault := "$HOME/Vaults/writing-vault/"

build-and-reload:
    #!/usr/bin/env zsh
    node sync-manifest.js
    node .esbuild.mjs

    plugin_id=$(grep '"id"' "./manifest.json" | cut -d'"' -f4)
    mkdir -p "{{ test_vault }}/.obsidian/plugins/$plugin_id/"
    cp -f "main.js" "{{ test_vault }}/.obsidian/plugins/$plugin_id/main.js"
    cp -f "manifest.json" "{{ test_vault }}/.obsidian/plugins/$plugin_id/manifest.json"
    vault_name=$(basename "{{ test_vault }}")
    open "obsidian://open?vault=$vault_name"

    # reload (REQUIRES: registering the URI manually in a helper plugin)
    open "obsidian://reload-plugin?id=$plugin_id&vault=$vault_name"

check-all:
    @echo "Running Biome check..."
    npx @biomejs/biome check --write.
    @echo "Running TypeScript check..."
    npx tsc --noEmit --skipLibCheck --strict
    @echo "Running Markdownlint check..."
    npx markdownlint-cli -c .markdownlint.json "**/*.md"
    @echo "All checks passed!"

check-tsc-qf:
    npx tsc --noEmit --skipLibCheck --strict && echo "Typescript OK"

release:
    node .release.mjs

analyze:
    node .esbuild.mjs analyze

init:
    #!/usr/bin/env zsh
    git config core.hooksPath .githooks
    npm install
    node .esbuild.mjs

update-deps:
    #!/usr/bin/env zsh
    npm update
    node .esbuild.mjs
