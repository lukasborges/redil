# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Redil is a fork of Rambox Community Edition, which upstream archived in 2022. It was renamed on 2026-09-21; the product, the app id, the Ext namespace and the repository all carry the new name. Version 0.8.0, GPL-3.0, Electron 44.

Upstream shipped Electron 13. The renderer has since been moved off three APIs that later releases removed, which is what allowed the jump: `remote` became `@electron/remote`, the `new-window` event became `setWindowOpenHandler`, and `desktopCapturer` moved to the main process behind the `screenShare:listSources` channel. The `volta` pin in `package.json` still names Node 14 and is stale; Node 24 installs and runs the project fine.

## Build and run

The renderer is a Sencha ExtJS 5.1.1 application that upstream compiled with **Sencha Cmd 6.6.0.13** plus Ruby 2.3 for Sass. That toolchain is no longer obtainable, so the project now boots without it:

```bash
npm install
npm run bootstrap       # writes bootstrap.js, replaces the Sencha microloader
npm start               # electron electron/main.js
npm run start:debug     # same, with --enable-logging
```

`scripts/gen-bootstrap.js` generates the `bootstrap.js` that `index.html` loads. It serves the Ext JS build already vendored in `ext/build/` and the theme CSS already compiled in `ext/packages/`, then points `Ext.Loader` at `app/` so the framework resolves `Redil.*` classes by name. Only files the loader cannot discover by class name are listed explicitly: the theme marker, the `Ext.override` calls in `overrides/`, the loose helper in `resources/js/`, and `app.js` last because it calls `Ext.application`. Regenerate after adding files in `overrides/` or `resources/js/`; ordinary classes under `app/` need no regeneration. `bootstrap.js` stays gitignored.

The Sass in `packages/local/redil-default-theme` is not compiled either. The app loads the stock `ext-theme-crisp` CSS that the custom theme extends, and `resources/css/redil-theme.css` then restates Redil's own look as plain CSS on top. That file must load last, which the generator guarantees.

A second stylesheet, `resources/css/redil-modern.css`, loads after it and carries a light modernisation: the system interface font, hairlines and whitespace in place of crisp's hard borders, flat buttons that sit inside the navy command bar, smaller tab labels, an active tab that reads as a lifted surface instead of a full width strip, rounded hover on the service catalogue, thin scrollbars and a flat unread badge. Its organising idea is that Redil is a frame around other people's apps, so the chrome recedes and the unread badge is the only saturated colour left. Removing that one line from the generator returns the original look.

Five things that file had to work around. Ext focuses the active tab programmatically, which matches `:focus-visible` and drew a detached ring, so keyboard focus is styled through Ext's own `.x-tab-default-focus` instead. The badge attribute stays on the element with an empty value at zero unread, which a restyled pseudo-element renders as a bare coloured pill unless it is explicitly hidden. The original theme padded the tab bar body down and pulled the strip back up to clear a strip this layer no longer draws, which left the body taller than the bar and showed as a white band under the tabs, so that padding is reset. Checkboxes are an `input` of type button wearing a sprite, so the rounded control is built by removing the sprite and drawing the box and tick in CSS, keyed off `.x-form-cb-checked` on the field wrapper three levels up. And a text field is an input and its triggers sitting side by side inside a wrapper, with the border on the wrapper alone, so the border, the corner and the focus ring all belong there; styling the input too produces two concentric rounded boxes, the inner one cutting across the trigger.

Style work belongs in those CSS files, not in the Sass, which no longer builds. Where the original set a Sass variable and let a theme mixin expand it, the CSS writes the visible result directly and names the variable in a comment. Two things to watch. Crisp often wins on specificity, for instance it paints the active tab from `.x-tab.x-tab-active.x-tab-default`, so an override needs to carry as many classes. And the original pulled Roboto and Josefin Sans from Google Fonts on every launch; the CSS resolves Roboto locally instead and drops Josefin Sans, which no rule ever referenced.

If Sencha Cmd is ever available again, `sencha app watch` still works and takes precedence, since it overwrites the same `bootstrap.js`.

Packaging runs from the repository itself:

```bash
npm run build:linux     # AppImage, deb and tar.gz into dist/
npm run build:win
npm run build:mac
```

Each one regenerates `bootstrap.js` first, because it is gitignored and the packaged app cannot boot without it. Upstream instead chained `sencha app build` into `electron-packager`, taking the compiled app from `build/production/Redil/`, which CI populated by cloning a separate `rambox-build` repository. All of that is gone: the `sencha:*`, `pack:*` and `all:*` scripts were removed along with `electron-packager`, and `electron-builder` alone produces the artifacts.

The `files` list in the build config is an allowlist rather than the default catch-all, because `ext/` is 121 MB and the app needs about 14 MB of it. If the renderer starts loading an Ext class that is not in `ext-all-rtl-debug.js` or under `ext/src`, add its path there or it will only fail in a packaged build.

Only Linux has been built and run end to end. Windows and macOS are configured but untested, and the macOS signing and notarisation path needs credentials plus a move to the renamed `@electron/notarize`.

There is no linter or formatter configured.

## Tests

```bash
npm test                                            # mocha over test/tests/**/*.spec.js
./node_modules/.bin/mocha test/tests/app/example.spec.js   # single spec
```

Tests are Mocha plus Chai driving the packaged app through Spectron. `test/helpers/RedilTestHelper.js` starts and stops Electron around each test. It requires `electron-prebuilt`, which is not in `package.json`, so the suite does not run as-is without adding that dependency or repointing the helper at the `electron` package.

## Architecture

Two processes with very different technology stacks, bridged by IPC.

**Main process** lives in `electron/`. `electron/main.js` owns the single `BrowserWindow`, the `electron-store` configuration object (its `defaults` block is the authoritative list of every preference key), tray, menu, auto-launch, proxy, master password window, and the screen-share picker. `electron/menu.js`, `electron/tray.js` and `electron/updater.js` are wired in from there. The updater reads releases from this repository's own GitHub releases, set as the feed in `electron/updater.js`; upstream pointed at the archived `ramboxapp/download`.

**Renderer** is the ExtJS app: `index.html` loads the generated `bootstrap.js`, `app.js` bootstraps `Redil.Application` (`app/Application.js`) with `Redil.view.main.Main` as the viewport. `app/` follows Sencha MVVM conventions, with view, controller and model files side by side under `app/view/<feature>/`. The bulk of the behavior is in `app/view/main/MainController.js`, `app/view/preferences/`, `app/view/add/`, and `app/ux/WebView.js`.

**Configuration flow.** The renderer never reads config directly. It calls `ipc.sendSync('getConfig')` and pushes changes back with `ipc.send('setConfig', ...)` or `sConfig` (partial merge). Adding a preference means touching the `defaults` in `electron/main.js`, the form in `app/view/preferences/Preferences.js`, and whichever consumer reads it.

**Services.** Two distinct stores, easy to confuse:

- `Redil.store.ServicesList` is the read-only catalog of supported apps, loaded over Ajax from `resources/services.json`. The store appends a synthetic `custom` entry on load. Upstream also published the same file on its `gh-pages` branch, frozen since 2021 and byte-identical to what we started from, so this fork maintains its own copy and that branch is not a source any more. `npm run check:services` fetches every URL and reports what has rotted; it only reports, it never edits the catalog. Read its output carefully: a domain that does not resolve is conclusive, while a timeout or a 403 usually means bot protection rather than a dead service, and a service that shut down but still redirects inside the same company, as several Google products did, does not show up at all.

  Dropping an entry does not remove it from anyone's configured services, which live in localStorage keyed by the catalog id. Code that looks a service up by id must cope with a miss; `Notifier`, `WebView` and the Add window all do. For the same reason the icons of removed services stay in `resources/icons`, because existing tabs still point at them.
- `Redil.store.Services` is the user's configured instances, persisted through an ExtJS localStorage proxy (`app/model/Service.js`). On load it turns each enabled record into a `webview` tab config and inserts it into the main tab panel, split by the `align` field into left and right groups.

**User agents.** Eight entries in `resources/services.json` pin a user agent, each naming whatever Chrome was current when the entry was written. `getUserAgent` in `app/ux/WebView.js` rewrites that version token to the Chromium the build actually runs on, keeping the platform half of the string, which is the part those entries exist for. Without it WhatsApp still announced Chrome 70 from 2018 and the site refused to load. An agent typed into Preferences is used verbatim, and a service with none pinned gets the browser's own with the Redil and Electron tokens stripped.

**Webviews.** `app/ux/WebView.js` (the largest renderer file) wraps each service in an Electron `<webview>` with a persistent session partition and the preload script `resources/js/rambox-service-api.js`. That preload exposes `window.rambox.setUnreadCount`, `clearUnreadCount` and `showWindowAndActivateTab`, which post back to the host via `sendToHost`; the panel listens for those `ipc-message` events. Unread detection comes from the `js_unread` snippet in the catalog entry concatenated with the user's own per-service custom code, injected with `executeJavaScript`. Services with no `js_unread` fall back to watching page title changes. `Redil.util.UnreadCounter` aggregates per-service counts into the global badge; `Redil.util.Notifier` raises the desktop notifications.

**Auxiliary windows** are plain HTML pages at the repo root loaded directly by the main process: `masterpassword.html` for the lock screen and `screenselector.html` for screen-share source selection.

## Traps worth knowing

The renderer runs with `nodeIntegration` on and `contextIsolation` off, and calls `require('electron')` freely, including from inline scripts in `index.html` and `masterpassword.html`. Because node is on, its own `process` is the renderer's, so `process.platform`, `process.arch` and `process.versions` are read directly and never over IPC.

`@electron/remote` is gone, and so is `remoteMain`. The renderer reaches main-process APIs through named IPC: `app:getVersion`, `app:quit`, `window:show`, `media:getAccessStatus`, `media:askForAccess` and `webview:clearData`. Three things that used to cross the bridge now live entirely in main, inside the `web-contents-created` handler that filters for webviews: the Google user-agent header rewrite, `certificate-error`, and `before-input-event`, which replays a shortcut typed inside a service into the host window so the app's Mousetrap sees it. Main decides a certificate error but cannot draw the warning, so it sends `webview:certificate-error` with the webContents id and the matching panel shows it; the renderer reports each service's `trust` flag over `webview:setTrust` as the service becomes ready, since the flag lives in its localStorage.

Context menus are built in `electron/contextmenu.js`, which `main.js` attaches to the main window and to each service `webContents`. It replaces `vendor/electron-contextmenu-wrapper`, the last thing holding the remote bridge up, which drew the menu in the renderer from `app.js` and from the service preload. Two behaviours differ deliberately. The package aimed cut, copy and paste at `getCurrentWindow()`, so a click inside a service acted on the host window instead of the service; the target is now whichever `webContents` reported the click. And it copied an image by drawing it into a canvas and writing the data URL, which only worked when the server allowed the cross-origin read; `copyImageAt` does it natively. The labels stay English and untranslated, as they were. Note that a webview carries two `context-menu` listeners, not one: Electron adds its own after attach, to forward the event to the `<webview>` element as a DOM event.

Service webviews set `sandbox=no`. Their preload script uses `require` to pull in node modules, which a sandboxed preload cannot do.

`electron/tray.js` does not use IPC to reach the renderer. It calls `win.webContents.executeJavaScript('ipc.send("toggleWin", false);')`, which depends on the global `ipc` that `app.js` defines near the top. Renaming that global silently breaks every tray interaction.

The `validateMasterPassword` handler in `electron/main.js` assigns `event.returnValue` twice, so it reads like it always answers `false`. It does not. Electron dispatches the reply on the first assignment and ignores the second, so a correct password does return `true`. This was verified by calling the channel directly. Leave the redundant line alone unless you retest.

`app.js` listens for `autoUpdater:update-available`, `autoUpdater:update-not-available` and `shortcut:tab`, none of which any main-process code sends. Three `ipcMain` handlers are likewise unreachable from this tree: `sendStatistics`, `image:download` and `image:popup`.

## Localization

Translations come from Crowdin. `npm run translations:download` reads the API key from `CROWDIN_API_KEY` and fetches CSVs into `resources/languages/<locale>/`, and `npm run translations:generate` collapses each locale folder into a single `resources/languages/<locale>.js` that assigns into a global `locale[]` array and deletes the folder. `index.html` injects the file for the configured locale before the app boots, which is why `locale['key']` is available at class-definition time in models and views. Do not hand-edit the generated `.js` files.

The key used to sit in `languages.js` in plain text. It is still in this repository's history and in the archived upstream, so it has to be revoked on Crowdin; deleting it from the working tree does not un-leak it. The `crowdin` package is also old enough to throw while loading on a modern Node, which is why it is required inside the download branch rather than at the top of the file: the generate command does not need it and used to break along with it.

## Conventions

`.editorconfig` mandates tabs (width 2) and LF. The ExtJS sources use Sencha's leading-comma style, with the comma starting each continuation line; match the surrounding file. `.npmrc` sets `save-exact=true` and disables `package-lock`, so dependency versions are pinned literally in `package.json` and no lockfile is committed.

`CONTRIBUTING.md` is upstream's and asks for `fix/xxx` or `feature/xxx` branches and no commits to the default branch, which `README.md` repeats. That was written for a project taking outside contributions; this fork has one maintainer, who works directly on `main`. Commit there rather than opening a branch per change. The rest of that file still holds, including that pull request titles carry no issue number.
