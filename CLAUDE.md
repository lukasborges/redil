# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Rambox Community Edition is archived upstream (see the EOL notice at the top of `README.md`). This fork is being revived. Version 0.8.0, GPL-3.0, Electron 44.

Upstream shipped Electron 13. The renderer has since been moved off three APIs that later releases removed, which is what allowed the jump: `remote` became `@electron/remote`, the `new-window` event became `setWindowOpenHandler`, and `desktopCapturer` moved to the main process behind the `screenShare:listSources` channel. The `volta` pin in `package.json` still names Node 14 and is stale; Node 24 installs and runs the project fine.

## Build and run

The renderer is a Sencha ExtJS 5.1.1 application that upstream compiled with **Sencha Cmd 6.6.0.13** plus Ruby 2.3 for Sass. That toolchain is no longer obtainable, so the project now boots without it:

```bash
npm install
npm run bootstrap       # writes bootstrap.js, replaces the Sencha microloader
npm start               # electron electron/main.js
npm run start:debug     # same, with --enable-logging
```

`scripts/gen-bootstrap.js` generates the `bootstrap.js` that `index.html` loads. It serves the Ext JS build already vendored in `ext/build/` and the theme CSS already compiled in `ext/packages/`, then points `Ext.Loader` at `app/` so the framework resolves `Rambox.*` classes by name. Only files the loader cannot discover by class name are listed explicitly: the theme marker, the `Ext.override` calls in `overrides/`, the two loose helpers in `resources/js/`, and `app.js` last because it calls `Ext.application`. Regenerate after adding files in `overrides/` or `resources/js/`; ordinary classes under `app/` need no regeneration. `bootstrap.js` stays gitignored.

The Sass in `packages/local/rambox-default-theme` is not compiled either. The app loads the stock `ext-theme-crisp` CSS that the custom theme extends, and `resources/css/rambox-theme.css` then restates Rambox's own look as plain CSS on top. That file must load last, which the generator guarantees.

Style work belongs in that CSS file, not in the Sass, which no longer builds. Where the original set a Sass variable and let a theme mixin expand it, the CSS writes the visible result directly and names the variable in a comment. Two things to watch. Crisp often wins on specificity, for instance it paints the active tab from `.x-tab.x-tab-active.x-tab-default`, so an override needs to carry as many classes. And the original pulled Roboto and Josefin Sans from Google Fonts on every launch; the CSS resolves Roboto locally instead and drops Josefin Sans, which no rule ever referenced.

If Sencha Cmd is ever available again, `sencha app watch` still works and takes precedence, since it overwrites the same `bootstrap.js`.

The production pipeline still assumes Sencha Cmd and therefore does not run today: `npm run sencha:clean`, `npm run sencha:compile` (runs `sencha app build`, then installs npm deps inside the compiled app), then `npm run pack:*` (electron-packager) and `npm run build:*` (electron-builder). The `all:linux` and `all:win` scripts chain the whole sequence. The pack and build scripts expect the compiled application at `build/production/Rambox/`, which CI populated by cloning the separate `rambox-build` repository into that path. Packaging needs a replacement for that step before releases can be produced again.

There is no linter or formatter configured.

## Tests

```bash
npm test                                            # mocha over test/tests/**/*.spec.js
./node_modules/.bin/mocha test/tests/app/example.spec.js   # single spec
```

Tests are Mocha plus Chai driving the packaged app through Spectron. `test/helpers/RamboxTestHelper.js` starts and stops Electron around each test. It requires `electron-prebuilt`, which is not in `package.json`, so the suite does not run as-is without adding that dependency or repointing the helper at the `electron` package.

## Architecture

Two processes with very different technology stacks, bridged by IPC.

**Main process** lives in `electron/`. `electron/main.js` owns the single `BrowserWindow`, the `electron-store` configuration object (its `defaults` block is the authoritative list of every preference key), tray, menu, auto-launch, proxy, master password window, and the screen-share picker. `electron/menu.js`, `electron/tray.js` and `electron/updater.js` are wired in from there. The updater pulls releases from the separate `ramboxapp/download` GitHub repository, not from this one.

**Renderer** is the ExtJS app: `index.html` loads the generated `bootstrap.js`, `app.js` bootstraps `Rambox.Application` (`app/Application.js`) with `Rambox.view.main.Main` as the viewport. `app/` follows Sencha MVVM conventions, with view, controller and model files side by side under `app/view/<feature>/`. The bulk of the behavior is in `app/view/main/MainController.js`, `app/view/preferences/`, `app/view/add/`, and `app/ux/WebView.js`.

**Configuration flow.** The renderer never reads config directly. It calls `ipc.sendSync('getConfig')` and pushes changes back with `ipc.send('setConfig', ...)` or `sConfig` (partial merge). Adding a preference means touching the `defaults` in `electron/main.js`, the form in `app/view/preferences/Preferences.js`, and whichever consumer reads it.

**Services.** Two distinct stores, easy to confuse:

- `Rambox.store.ServicesList` is the read-only catalog of supported apps, loaded over Ajax from `resources/services.json`. Upstream this file lives on the `gh-pages` branch as `api/services.json`; new services are appended to the bottom of that array. The store appends a synthetic `custom` entry on load.
- `Rambox.store.Services` is the user's configured instances, persisted through an ExtJS localStorage proxy (`app/model/Service.js`). On load it turns each enabled record into a `webview` tab config and inserts it into the main tab panel, split by the `align` field into left and right groups.

**Webviews.** `app/ux/WebView.js` (the largest renderer file) wraps each service in an Electron `<webview>` with a persistent session partition and the preload script `resources/js/rambox-service-api.js`. That preload exposes `window.rambox.setUnreadCount`, `clearUnreadCount` and `showWindowAndActivateTab`, which post back to the host via `sendToHost`; the panel listens for those `ipc-message` events. Unread detection comes from the `js_unread` snippet in the catalog entry concatenated with the user's own per-service custom code, injected with `executeJavaScript`. Services with no `js_unread` fall back to watching page title changes. `Rambox.util.UnreadCounter` aggregates per-service counts into the global badge; `Rambox.util.Notifier` raises the desktop notifications.

**Auxiliary windows** are plain HTML pages at the repo root loaded directly by the main process: `masterpassword.html` for the lock screen and `screenselector.html` for screen-share source selection.

## Traps worth knowing

The renderer runs with `nodeIntegration` on and `contextIsolation` off, and calls `require('electron')` freely, including from inline scripts in `index.html` and `masterpassword.html`. The renderer reaches main-process APIs through `@electron/remote`, which the main process initialises once and then enables per `webContents`. A new window whose renderer needs those APIs must be passed to `remoteMain.enable`, or every `require('@electron/remote')` call in it returns undefined.

Service webviews set `sandbox=no`. Their preload script uses `require` to pull in node modules, which a sandboxed preload cannot do.

`electron/tray.js` does not use IPC to reach the renderer. It calls `win.webContents.executeJavaScript('ipc.send("toggleWin", false);')`, which depends on the global `ipc` that `app.js` defines at line 17. Renaming that global silently breaks every tray interaction.

The `validateMasterPassword` handler in `electron/main.js` assigns `event.returnValue` twice, so it reads like it always answers `false`. It does not. Electron dispatches the reply on the first assignment and ignores the second, so a correct password does return `true`. This was verified by calling the channel directly. Leave the redundant line alone unless you retest.

`app.js` listens for `autoUpdater:update-available`, `autoUpdater:update-not-available` and `shortcut:tab`, none of which any main-process code sends. Three `ipcMain` handlers are likewise unreachable from this tree: `sendStatistics`, `image:download` and `image:popup`.

## Localization

Translations come from Crowdin. `npm run translations:download` fetches CSVs into `resources/languages/<locale>/`, and `npm run translations:generate` collapses each locale folder into a single `resources/languages/<locale>.js` that assigns into a global `locale[]` array and deletes the folder. `index.html` injects the file for the configured locale before the app boots, which is why `locale['key']` is available at class-definition time in models and views. Do not hand-edit the generated `.js` files.

## Conventions

`.editorconfig` mandates tabs (width 2) and LF. The ExtJS sources use Sencha's leading-comma style, with the comma starting each continuation line; match the surrounding file. `.npmrc` sets `save-exact=true` and disables `package-lock`, so dependency versions are pinned literally in `package.json` and no lockfile is committed.

`vendor/electron-contextmenu-wrapper` is a vendored copy of a package whose upstream repository is archived, installed through a `file:` dependency. It was forked only to move it off the removed `remote` module; both touched files say so at the top. Treat it as third-party code and keep changes minimal.

Per `CONTRIBUTING.md`: branch names are `fix/xxx` or `feature/xxx`, never commit to `master`, and pull request titles must not contain the issue number.
