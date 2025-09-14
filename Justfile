# WordSmith Plugin Development Tasks

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

build:
    node .esbuild.mjs

typecheck:
    npx tsc --noEmit --skipLibCheck --strict

release:
    node .release.mjs

analyze:
    node .esbuild.mjs analyze

init:
    #!/usr/bin/env zsh
    npm install
    node .esbuild.mjs

update-deps:
    #!/usr/bin/env zsh
    npm update
    node .esbuild.mjs
