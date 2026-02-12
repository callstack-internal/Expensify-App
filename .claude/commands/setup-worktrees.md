Run the worktree setup script to configure git worktrees and shell aliases for parallel development with Claude Code.

Execute `bash scripts/setup-worktrees.sh` from the repository root.

After the script completes, tell the user to run `source ~/.config/worktree-aliases.zsh` to activate the aliases in their current shell (or open a new terminal).

Then show this quick reference:

## Quick Reference

| Command | Description |
|---------|-------------|
| `w1`..`w3` | Jump to worktree 1-3 |
| `main` | Jump to main repo |
| `c1`..`c3` | Open Claude in worktree 1-3 |
| `cmain` | Open Claude in main repo |
| `wpr <number> [wt]` | Checkout PR in worktree (default: w1) |
| `wnew <branch>` | Create new branch from main |
| `wco <branch>` | Checkout existing branch |
| `wpull` | Pull latest main |
| `wnpm` | Install npm dependencies |
| `wwhich` | Show current worktree |
| `whelp` | Full command reference |
