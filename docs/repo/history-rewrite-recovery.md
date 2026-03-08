# History Rewrite Recovery

This repository history was rewritten to remove tracked environment files.

## Other machines

Use one of the following options on every existing clone.

### Recommended: re-clone

```bash
git clone https://github.com/callendar-yojung/pecal.git
```

### Existing clone: hard reset

```bash
git fetch --all --prune --tags
git checkout main
git reset --hard origin/main
git tag -l | xargs -n 1 git tag -d
git fetch --tags --force
```

## Notes

- Local uncommitted work must be backed up before reset.
- Old commit hashes are no longer valid after the rewrite.
- Any automation or deployment pinned to old SHAs must be updated.
