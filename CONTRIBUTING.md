# Contributing

Shep has one maintainer, who commits to `main`. A pull request from a branch is welcome; so is an issue that says what happened, on which distribution and desktop, and, for a service that misbehaves, which address you added.

## Running it

```bash
npm install
npm start
npm test
```

`npm test` has to pass before a change goes in: it typechecks, lints, builds, runs the unit tests and then the end-to-end suite, which launches the app. On Linux, install `xvfb-run` and `xdotool` so its windows open on a virtual display instead of your desktop; on Windows they open on the desktop, and the one test that needs `xdotool` skips itself.

A change to the packaging or to anything the main process asks the system for should be tried on both: the build workflow packages on Linux and on Windows, and a change that only one of them can run belongs behind `process.platform`.

## The rule for services

Shep has no code for any one service, and a change must not add any. Every service is a web address with a session of its own: its icon is its favicon, its count is its title, its links stay in the app. When a site does not work, the fix is to the rule every site goes through, with a test that shows the rule on a page of the suite's own, in `tests/e2e/fixtures`. A host name in the source is the sign of a special case.

## Tests

Put a pure function under test in `tests/unit`, with `node:test`. Anything that needs Electron goes in `tests/e2e`, with Playwright, against fixture pages the suite serves on localhost. Only `npm run test:network` loads real sites. A bug fix comes with the test that failed before it.

## Strings

Every string the interface shows is a key in `src/shared/i18n/en.ts` and in each of the nine other catalogues beside it. The typecheck and a unit test refuse a key that is missing from any of them. A translation you are not sure of is still better than English in the middle of another language, and a native speaker's correction is always welcome.

## Commits

One line, in English, starting with a [gitmoji](https://gitmoji.dev) and following [Conventional Commits](https://www.conventionalcommits.org): `🐛 fix(links): keep a sign-in popup attached to its opener`. The subject says what changed for someone using the app, not which files moved.

## Style

Tabs, LF, and whatever the file around your change already does. `.editorconfig` settles the whitespace and ESLint the mistakes; there is no formatter to argue with.
