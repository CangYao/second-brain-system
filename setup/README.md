# Setup entry points

setup.ps1: new empty target, dry-run/non-interactive, optional feature flags; no software/Git installation.

self-test.ps1: required structure/metadata/config/Workflow references plus optional warnings.

detect-dependencies.ps1: feature readiness; does not download.

upgrade.ps1: dry-run/system manifest/hash checks, conflict-zero-write, bounded backups outside Vault. See ../docs/upgrading.md.
