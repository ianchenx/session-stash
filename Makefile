# Session Stash — build automation
#
# Quick Start:
#   make dev         Start Plasmo dev server (loads build/chrome-mv3-dev/ in Chrome)
#   make build       Production build
#   make package     Zip for Web Store upload
#   make check       Typecheck + prettier check + biome lint + tests
#   make lint        Lint (biome)
#   make format      Autofix formatting (prettier)
#   make screenshots Regenerate assets/screenshots/*.png (playwright)
#
# Release flow:
#   1. make preflight                       verify clean tree + checks pass
#   2. make version-{patch|minor|major}     bump package.json + commit
#   3. make tag                             create vX.Y.Z tag from package.json
#   4. make release                         push main + tag

.PHONY: help dev build package install test test-watch typecheck lint format-check \
        format check screenshots clean preflight version-patch version-minor \
        version-major tag release-dry release

SHELL := /bin/bash

# ── Quick Start ──────────────────────────────────────

dev:                    ## Start Plasmo dev server (HMR)
	pnpm dev

build:                  ## Production build → build/chrome-mv3-prod/
	pnpm build

package: build          ## Zip for Web Store → build/chrome-mv3-prod.zip
	pnpm package

install:                ## Install dependencies
	pnpm install

# ── Quality ──────────────────────────────────────────

test:                   ## Run tests (vitest)
	pnpm test

test-watch:             ## Run tests in watch mode
	pnpm test:watch

typecheck:              ## TypeScript typecheck (no emit)
	pnpm exec tsc --noEmit

format-check:           ## Check formatting (prettier)
	pnpm exec prettier --check . --ignore-path .gitignore

lint:                   ## Lint source code (biome)
	pnpm exec biome lint

format:                 ## Format all files (prettier)
	pnpm exec prettier --write . --ignore-path .gitignore

check: typecheck format-check lint test  ## Typecheck + prettier check + biome lint + tests

# ── Screenshots ──────────────────────────────────────

screenshots: build      ## Regenerate Web Store / README screenshots → assets/screenshots/
	@echo "▶ First run? install chromium: pnpm exec playwright install chromium"
	node scripts/screenshots/capture.mjs

# ── Maintenance ──────────────────────────────────────

clean:                  ## Remove build artifacts
	rm -rf build/ .plasmo/ tsconfig.tsbuildinfo

# ── Release ──────────────────────────────────────────
#
# Note: manifest version is derived from package.json "version" (Plasmo convention),
# so bumping package.json also bumps the extension version.

VERSION := $(shell node -p "require('./package.json').version")

preflight:              ## Verify clean tree + full check (tsc + lint + format + tests)
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ Working tree is dirty. Commit or stash first."; exit 1; \
	fi
	@$(MAKE) check
	@echo "✅ Preflight passed (v$(VERSION))"

version-patch:          ## Bump patch (0.1.0 → 0.1.1) + commit
	@npm version patch --no-git-tag-version
	@NEW=$$(node -p "require('./package.json').version"); \
	git add package.json && \
	git commit -m "chore: bump version to $$NEW" && \
	echo "✅ Version bumped to $$NEW"

version-minor:          ## Bump minor (0.1.0 → 0.2.0) + commit
	@npm version minor --no-git-tag-version
	@NEW=$$(node -p "require('./package.json').version"); \
	git add package.json && \
	git commit -m "chore: bump version to $$NEW" && \
	echo "✅ Version bumped to $$NEW"

version-major:          ## Bump major (0.1.0 → 1.0.0) + commit
	@npm version major --no-git-tag-version
	@NEW=$$(node -p "require('./package.json').version"); \
	git add package.json && \
	git commit -m "chore: bump version to $$NEW" && \
	echo "✅ Version bumped to $$NEW"

tag:                    ## Create git tag vX.Y.Z from package.json version
	@if git rev-parse "v$(VERSION)" >/dev/null 2>&1; then \
		echo "❌ Tag v$(VERSION) already exists"; exit 1; \
	fi
	git tag -a "v$(VERSION)" -m "v$(VERSION)"
	@echo "✅ Tagged v$(VERSION)"

release-dry:            ## Show what would be pushed (no side effects)
	@echo "Version:  v$(VERSION)"
	@echo "Branch:   $$(git branch --show-current)"
	@echo "Tag:      v$(VERSION) → $$(git rev-parse --short HEAD)"
	@echo "Commits to push:"
	@git log --oneline origin/main..HEAD 2>/dev/null || echo "  (no remote tracking)"
	@echo ""
	@echo "This would run: git push -u origin main && git push origin v$(VERSION)"

release:                ## Push main + tag (Chrome Web Store submission is still manual)
	@if ! git rev-parse "v$(VERSION)" >/dev/null 2>&1; then \
		echo "❌ Tag v$(VERSION) does not exist. Run 'make tag' first."; exit 1; \
	fi
	@echo "▶ Pushing main…"
	git push -u origin main
	@echo "▶ Pushing tag v$(VERSION)…"
	git push origin "v$(VERSION)"
	@echo "✅ Released v$(VERSION)"
	@echo ""
	@echo "Next: publish to Chrome Web Store (manual)"
	@echo "  1. Wait for CI to finish, then download session-stash-v$(VERSION).zip"
	@echo "     from https://github.com/ianchenx/session-stash/releases/tag/v$(VERSION)"
	@echo "  2. Chrome Web Store dashboard → Upload new package → Submit for review"

# ── Help ─────────────────────────────────────────────

help:                   ## Show this help
	@grep -E '^[a-z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
