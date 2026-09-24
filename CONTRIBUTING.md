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

## Branches and commits

Never commit to `main`. Branch as `fix/short-description` or `feature/short-description`.

Keep the commit subject on one line and say what changed rather than what you touched.

## Services

There is no catalogue to add a service to: the Add window takes any address, and every service is handled the same way, with its favicon as the icon, its page title as the unread count, and its links kept inside the app. A change that only one service needs is a change to that general rule, not a special case.

## Building

```bash
npm run build:linux   # AppImage, deb and tar.gz into dist/
```

Windows and macOS targets are configured but have not been built or tested by this fork. If you have those machines, reports are welcome.

## Tests

The suite is a single Spectron test inherited from upstream, and Spectron was abandoned in 2022. Moving it to Playwright is open work and a good first contribution.
