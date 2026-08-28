# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues. Use the `gh` CLI
for issue operations and infer the repository from `git remote -v`.

## Conventions

- Create issues with `gh issue create`.
- Read issues and comments with `gh issue view <number> --comments`.
- List issues with `gh issue list`, requesting labels and comments as JSON when skills need structured input.
- Comment with `gh issue comment <number>`.
- Apply or remove labels with `gh issue edit <number>`.
- Close issues with `gh issue close <number>` and include a concise resolution comment.

When a skill says to publish to the issue tracker, create a GitHub issue. When
it says to fetch the relevant ticket, read the matching GitHub issue and its
comments.
