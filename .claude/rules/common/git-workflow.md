# Git Workflow

## Commit Message Format

```
<type>: <description>

<optional body>
```

| Types       | Note                                   |
| ----------- | -------------------------------------- |
| 🏗️ Arch     | Make architectural changes             |
| 🍱 Asset    | Add or update assets                   |
| 👷 CI       | Add or update CI build system          |
| ⬆️ Deps     | Add or upgrade a dependency            |
| 🧑‍💻 Dev UX   | Improve developer experience           |
| 📝 Docs     | Add or update documentation            |
| ✨ Feat     | Introduce new features                 |
| 🐛 Fix      | Fix a bug                              |
| 🙈 Ignore   | Add or update a .gitignore file        |
| 🤡 Mock     | Mock things                            |
| ⚡️ Perf     | Improve performance                    |
| ♻️ Refactor | Refactor code                          |
| 🎨 Refactor | Improve structure / format of the code |
| 🔥 Remove   | Remove code or files                   |
| 🔒️ Sec      | Fix security or privacy issues         |
| 🔍️ SEO      | Improve SEO                            |
| 💄 Style    | Add or update the UI and style files   |
| ✅ Test     | Add, update, or pass tests             |
| 🧪 Test     | Add a failing test                     |
| ✏️ Typo     | Fix typos                              |
| 🚸 UX       | Improve user experience / usability    |

Note: Attribution disabled globally via ~/.claude/settings.json.

## Pull Request Workflow

When creating PRs:

1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
