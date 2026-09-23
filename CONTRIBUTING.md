# Contributing

Shep is a fork of Rambox Community Edition, revived after upstream archived it. It is small and the process is light. What follows is what you actually need.

## Getting it running

Node 22 or newer, and npm. Nothing else. The prerequisites the old guide listed, Sencha Cmd and Ruby, are gone: the renderer now boots from a generated file instead of a Sencha build.

```bash
git clone https://github.com/lukasborges/shep.git
cd shep
npm install
npm run bootstrap
npm start
```

On Linux, `npm start` may abort with a fatal GPU error, because the Electron that npm installs ships its sandbox helper without the setuid bit. Start it with `--no-sandbox`, which is what the packaged Linux builds already do.

Read `CLAUDE.md` before changing much. It covers the architecture and, more usefully, the handful of places in this codebase that behave in ways the code does not suggest.

## Branches and commits

Never commit to `main`. Branch as `fix/short-description` or `feature/short-description`.

Keep the commit subject on one line and say what changed rather than what you touched.

## Adding or changing a service

Services live in `resources/services.json`. Append to the end of the array and copy the shape of a neighbouring entry.

Two fields are worth understanding:

- `userAgent` only needs to be set when the service refuses the default one. Give the platform you want to present and any Chrome version; the app rewrites the version to the Chromium it is running, so the entry will not rot.
- `js_unread` runs inside the service's page and reports the unread count by calling `rambox.setUnreadCount(n)` or `rambox.clearUnreadCount()`. That global keeps its original name on purpose: every entry in the catalogue calls it, and renaming it would break all of them at once.

Run `npm run check:services` before opening a pull request that touches the catalogue. It reports entries whose URLs have rotted. A domain that does not resolve is conclusive; a timeout or a 403 usually means bot protection rather than a dead service, so check those by hand.

## Building

```bash
npm run build:linux   # AppImage, deb and tar.gz into dist/
```

Windows and macOS targets are configured but have not been built or tested by this fork. If you have those machines, reports are welcome.

## Tests

The suite is a single Spectron test inherited from upstream, and Spectron was abandoned in 2022. Moving it to Playwright is open work and a good first contribution.
