# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Redil is a fork of Rambox Community Edition, which upstream archived in 2022. It was renamed on 2026-09-21; the product, the app id, the Ext namespace and the repository all carry the new name. The mark changed with it: `resources/logo/Logo.svg` is the source, a sheepdog in a gradient circle, and every PNG and ICO under `resources/` and `resources/installer/icons/` is generated from it. The circle and the gradient are inherited from Rambox deliberately; the animal and the direction the gradient lightens are what tell them apart. Head and ears are one outline, because separate shapes merge into a blur at 16px. The unread tray variant is the same mark with the animal in the alert colour, which is the convention the old icons already used. `resources/installer/icon.icns` was left alone: no tool here writes icns, and electron-builder builds the macOS icon from the icons directory anyway. Version 0.9.0, GPL-3.0, Electron 44.

Upstream shipped Electron 13. The renderer has since been moved off three APIs that later releases removed, which is what allowed the jump: `remote` became `@electron/remote`, the `new-window` event became `setWindowOpenHandler`, and `desktopCapturer` moved to the main process. The `volta` pin in `package.json` named Node 14 until it was moved to 24.19.0, which is what this works on; CI builds on 22.

## Build and run

The renderer is a Sencha ExtJS 5.1.1 application that upstream compiled with **Sencha Cmd 6.6.0.13** plus Ruby 2.3 for Sass. That toolchain is no longer obtainable, and everything only it could read has been deleted: `.sencha/`, `ext/.sencha/`, `app.json`, `workspace.json`, both `build.xml` files and every `sass/` directory. The project boots with nothing but npm:

```bash
npm install
npm run bootstrap       # writes bootstrap.js, replaces the Sencha microloader
npm start               # electron electron/main.js
npm run start:debug     # same, with --enable-logging
```

`scripts/gen-bootstrap.js` generates the `bootstrap.js` that `index.html` loads. It serves the Ext JS build already vendored in `ext/build/` and the theme CSS already compiled in `ext/packages/`, then points `Ext.Loader` at `app/` so the framework resolves `Redil.*` classes by name. Only files the loader cannot discover by class name are listed explicitly: the theme marker, the `Ext.override` calls in `overrides/`, the loose helper in `resources/js/`, and `app.js` last because it calls `Ext.application`. The marker is `overrides/theme-init.js` and must load before the overrides beside it, so the generator names it first and then filters it out of the directory walk that would otherwise load it twice. Regenerate after adding files in `overrides/` or `resources/js/`; ordinary classes under `app/` need no regeneration. `bootstrap.js` stays gitignored.

The custom theme's Sass is gone with the rest. The app loads the stock `ext-theme-crisp` CSS that the theme used to extend, and `resources/css/redil-theme.css` then restates Redil's own look as plain CSS on top. That file must load last, which the generator guarantees.

What survives of the theme package is only what the generator loads, and it no longer lives in a Sencha package: Font Awesome moved to `resources/fonts/font-awesome/`, and the two lines that set `Ext.theme.name` are now `overrides/theme-init.js`. `packages/` is gone. Its icomoon font and toolbar images went with the Sass that referenced them.

A second stylesheet, `resources/css/redil-modern.css`, loads after it and carries a light modernisation: the system interface font, hairlines and whitespace in place of crisp's hard borders, flat buttons that sit inside the navy command bar, smaller tab labels, an active tab that reads as a lifted surface instead of a full width strip, rounded hover on the service catalogue, thin scrollbars and a flat unread badge. Its organising idea is that Redil is a frame around other people's apps, so the chrome recedes and the unread badge is the only saturated colour left. Removing that one line from the generator returns the original look.

Five things that file had to work around. Ext focuses the active tab programmatically, which matches `:focus-visible` and drew a detached ring, so keyboard focus is styled through Ext's own `.x-tab-default-focus` instead. The badge attribute stays on the element with an empty value at zero unread, which a restyled pseudo-element renders as a bare coloured pill unless it is explicitly hidden. The original theme padded the tab bar body down and pulled the strip back up to clear a strip this layer no longer draws, which left the body taller than the bar and showed as a white band under the tabs, so that padding is reset. Checkboxes are an `input` of type button wearing a sprite, so the rounded control is built by removing the sprite and drawing the box and tick in CSS, keyed off `.x-form-cb-checked` on the field wrapper three levels up. And a text field is an input and its triggers sitting side by side inside a wrapper, with the border on the wrapper alone, so the border, the corner and the focus ring all belong there; styling the input too produces two concentric rounded boxes, the inner one cutting across the trigger.

Every colour that layer paints is a token on `:root`, and the dark theme is one media query that changes nothing but their values. That indirection is what made a dark theme affordable at all: the crisp stylesheet underneath carries 102 colours across a megabyte of CSS that cannot be recompiled, so rather than fight it rule by rule, `redil-modern.css` paints over the surfaces that actually show -- panel bodies, windows, grids, drop-downs, fields, labels, tooltips -- and does it through names. In the light theme those rules resolve to what crisp already drew, so they change nothing; they exist so the dark theme has something to change. A new colour anywhere in that file should be a token, or the dark theme will have a hole in it.

What drives the query is `nativeTheme.themeSource`, which `electron/main.js` sets from the `theme` preference, one of `system`, `light` or `dark`. There is no class or attribute on the document: Electron keeps `prefers-color-scheme` in step with `themeSource`, which also carries the choice into the native menus and dialogs, and it is applied in `createWindow` before the window exists so the first paint is already right.

Style work belongs in those CSS files; there is no Sass left to change. Where the original set a Sass variable and let a theme mixin expand it, the CSS writes the visible result directly and names the variable in a comment. Two things to watch. Crisp often wins on specificity, for instance it paints the active tab from `.x-tab.x-tab-active.x-tab-default`, so an override needs to carry as many classes. And the original pulled Roboto and Josefin Sans from Google Fonts on every launch; the CSS resolves Roboto locally instead and drops Josefin Sans, which no rule ever referenced.

Packaging runs from the repository itself:

```bash
npm run build:linux     # AppImage, deb and tar.gz into dist/
npm run build:win
npm run build:mac
```

Each one regenerates `bootstrap.js` first, because it is gitignored and the packaged app cannot boot without it. Upstream instead chained `sencha app build` into `electron-packager`, taking the compiled app from `build/production/Redil/`, which CI populated by cloning a separate `rambox-build` repository. All of that is gone: the `sencha:*`, `pack:*` and `all:*` scripts were removed along with `electron-packager`, and `electron-builder` alone produces the artifacts.

The `files` list in the build config is an allowlist rather than the default catch-all, because `ext/` is 121 MB and the app needs about 14 MB of it. If the renderer starts loading an Ext class that is not in `ext-all-rtl-debug.js` or under `ext/src`, add its path there or it will only fail in a packaged build.

Only Linux has been built and run end to end. Windows and macOS are configured but untested. The notarisation hook now uses the renamed `@electron/notarize`, whose v3 drops the legacy altool path, so it takes a `teamId` and no `appBundleId` or `ascProvider`; it reads `APPLE_ID`, `APPLE_ID_PWD` and `APPLE_TEAM_ID` from the environment and skips itself when they are absent, where upstream hardcoded its own Apple ID and team.

`npm run lint` runs ESLint, and `npm test` runs it before the suite. The config is scoped to the code this fork wrote -- `electron/`, `scripts/`, `test/`, the service preload, `languages.js` -- and ignores `app/`, `overrides/`, `ext/` and `resources/js/loadscreen.js`, which is a minified Modernizr build. Linting a 2016 Sencha application would bury a real finding under thousands nobody will act on. The rules are the ones that catch mistakes; `.editorconfig` settles formatting and there is no formatter to argue with.

## Tests

```bash
npm test                                    # regenerates bootstrap.js, then runs Playwright
npx playwright test test/contextmenu.spec.js   # one file
npx playwright test -g "user agent"            # one test by name
```

Playwright's Electron support drives the suite, in place of Spectron, which was abandoned in 2022 alongside upstream and had never been installable here anyway: the old helper required `electron-prebuilt`, which was not in `package.json`. Mocha and Chai went with it, so `@playwright/test` is the only test dependency and it downloads no browsers, because the suite launches this app and nothing else.

`test/catalogue.spec.js` and `test/contextmenu.spec.js` need no app: the first checks every entry's shape, unique ids, an icon file on disk, a type the add window can actually show, and an https url; the second is the same idea for the context menu, because `template` in `electron/contextmenu.js` is a pure function whose cases record the behaviour inherited from the package it replaced. `test/app.spec.js` launches the real thing through `test/helpers/launch.js`.

Three things that helper has to get right. Each launch gets its own `--user-data-dir`, or the run reads the developer's own configuration, opens whatever services they have configured and talks to the network, which makes the assertions depend on the machine. Running unpacked makes `isDev` true, so `main.js` opens the DevTools and the app has **two** windows; `firstWindow()` returns whichever won the race, which made the suite fail two runs in three until the helper started finding the window by its URL. And the window exists well before Ext does, so it waits for the viewport rather than for load.

Electron needs a display, so CI runs the suite under `xvfb-run`.

## Architecture

Two processes with very different technology stacks, bridged by IPC.

**Main process** lives in `electron/`. `electron/main.js` owns the single `BrowserWindow`, the `electron-store` configuration object (its `defaults` block is the authoritative list of every preference key), tray, menu, auto-launch, proxy, master password window, and the screen-share picker. `electron/menu.js`, `electron/tray.js` and `electron/updater.js` are wired in from there. The updater forwards `update-available`, `update-not-available` and `update-downloaded` to the renderer, which has a dialog for each; it forwarded only the last one until the other two were connected, so Check for updates answered nothing unless an update had already downloaded. The updater reads releases from this repository's own GitHub releases, set as the feed in `electron/updater.js`; upstream pointed at the archived `ramboxapp/download`.

**The service bar** is a vertical rail of icons fixed to the left, in the shape Franz and Station settled on. Ext gives the layout for free -- `MainController.initialize` calls `setTabPosition('left')`, hardcoded -- so `redil-modern.css` only supplies the appearance. The rail carries the whole of the window's chrome: the three buttons at its foot, don't disturb, lock and preferences, were the home tab's own `tbar` until they moved into `tabBar.items`, which meant they disappeared whenever a service was open. A tab bar is a `Header`, not a `Toolbar`, so the `'->'` shorthand resolves to null there and every item needs its `xtype` spelled out; the fill is `{ xtype: 'tbfill' }`.

Three preferences went with that decision, and they are gone from the defaults, the Preferences form and the Add window: `tabbar_location`, which offered four sides; `hide_tabbar_labels`, because a rail of icons has no label to hide; and the per-service `tabname`. A service's name is its tab's `tooltip` now. The `tabname` field stays on the model so records written before this keep their shape, and nothing reads it.

**Renderer** is the ExtJS app: `index.html` loads the generated `bootstrap.js`, `app.js` bootstraps `Redil.Application` (`app/Application.js`) with `Redil.view.main.Main` as the viewport. `app/` follows Sencha MVVM conventions, with view, controller and model files side by side under `app/view/<feature>/`. The bulk of the behavior is in `app/view/main/MainController.js`, `app/view/preferences/`, `app/view/add/`, and `app/ux/WebView.js`.

**Configuration flow.** The renderer never reads config directly. It calls `ipc.sendSync('getConfig')` and pushes changes back with `ipc.send('setConfig', ...)` or `sConfig` (partial merge). Adding a preference means touching the `defaults` in `electron/main.js`, the form in `app/view/preferences/Preferences.js`, and whichever consumer reads it.

**Services.** Two distinct stores, easy to confuse:

- `Redil.store.ServicesList` is the read-only catalog of supported apps, loaded over Ajax from `resources/services.json`. The store appends a synthetic `custom` entry on load. Upstream also published the same file on its `gh-pages` branch, frozen since 2021 and byte-identical to what we started from, so this fork maintains its own copy and that branch is not a source any more. `npm run check:services` fetches every URL and reports what has rotted; it only reports, it never edits the catalog. Read its output carefully: a domain that does not resolve is conclusive, while a timeout or a 403 usually means bot protection rather than a dead service, and a service that shut down but still redirects inside the same company, as several Google products did, does not show up at all.

  The catalogue holds 104 entries. Ten modern ones were added -- Google Meet, Zoom, ChatGPT, Claude, Gemini, Perplexity, Bluesky, Threads, X and HEY -- and seven were dropped: `icq`, `flowdock`, `sandstorm`, `mysms` and `bearychat` answered no HTTP at all on two separate runs, and ICQ's host no longer resolves; `tweetdeck` now lands on X's login for the paid X Pro; and `riot` was app.element.io under the name Element dropped in 2020, which the `element` entry already covers. New entries carry no `js_unread`: writing one means reading a logged-in page's DOM, and a service without it falls back to watching the page title.

  `app/store/Services.js` used to rewrite a configured `spark` service to type `webexteams` with logo `webexteams.png`, and neither the entry nor the icon has ever existed in this tree, so it repointed those tabs at nothing. The rewrite is gone and the entry, whose id is the storage key and cannot change, is now labelled Webex.

  Dropping an entry does not remove it from anyone's configured services, which live in localStorage keyed by the catalog id. Code that looks a service up by id must cope with a miss; `Notifier`, `WebView` and the Add window all do. For the same reason the icons of removed services stay in `resources/icons`, because existing tabs still point at them.
- `Redil.store.Services` is the user's configured instances, persisted through an ExtJS localStorage proxy (`app/model/Service.js`). On load it turns each enabled record into a `webview` tab config and inserts it into the main tab panel, split by the `align` field into left and right groups.

**User agents.** Eight entries in `resources/services.json` pin a user agent, each naming whatever Chrome was current when the entry was written. `getUserAgent` in `app/ux/WebView.js` rewrites that version token to the Chromium the build actually runs on, keeping the platform half of the string, which is the part those entries exist for. Without it WhatsApp still announced Chrome 70 from 2018 and the site refused to load. An agent typed into Preferences is used verbatim, and a service with none pinned gets the browser's own with the Redil and Electron tokens stripped.

**Webviews.** `app/ux/WebView.js` (the largest renderer file) wraps each service in an Electron `<webview>` with a persistent session partition and the preload script `resources/js/rambox-service-api.js`. That preload exposes `window.rambox.setUnreadCount`, `clearUnreadCount` and `showWindowAndActivateTab` over `contextBridge`, each posting back to the host via `sendToHost`; the panel listens for those `ipc-message` events. Screen sharing is answered by `setDisplayMediaRequestHandler` on the service's session, which opens the picker and hands back a source; it replaced a patch the preload wrote over `navigator.mediaDevices.getDisplayMedia`, which an isolated preload cannot reach. Unread detection comes from the `js_unread` snippet in the catalog entry concatenated with the user's own per-service custom code, injected with `executeJavaScript`. Services with no `js_unread` fall back to watching page title changes. `Redil.util.UnreadCounter` aggregates per-service counts into the global badge; `Redil.util.Notifier` raises the desktop notifications.

**Auxiliary windows** are plain HTML pages at the repo root loaded directly by the main process: `masterpassword.html` for the lock screen and `screenselector.html` for screen-share source selection. With a master password set, the lock window is the only one that opens: the main window is not created until the lock is cleared, which is why a test that starts from that state cannot wait for `index.html`.

## Traps worth knowing

The main window runs with `contextIsolation` on and `nodeIntegration` off. It reaches Electron only through `electron/preload.js`, which exposes one object, `window.redil`: an `ipc` with `send`, `sendSync`, `invoke`, `on` and `removeListener`, plus `platform`, `arch` and `versions`, which the renderer used to read off node's own `process`. There is no `require` in the page.

Both channel lists in that preload are closed. Calling a channel that is not on one throws, which is deliberate: a bridge that forwarded anything would hand back most of the reach the isolation removes. Adding a channel means adding it there too, or it will fail only at runtime. The `IpcRendererEvent` does not cross the bridge, so a listener is called with `undefined` in its first argument; every handler took it and ignored it already.

Two things the renderer could not keep. Mousetrap is a browser library it required as a module, and the generator now loads `node_modules/mousetrap/mousetrap.js` as a plain script, which works packaged because electron-builder keeps `node_modules` in the asar. `is-online` moved to the main process behind `net:isOnline`, where a network probe belonged anyway.

`masterpassword.html` and `screenselector.html` share the same preload and are isolated too; the three `screenShare:*` channels in its list belong to the second of them.

The service webviews are isolated and sandboxed as well, and this is the part to understand before touching them: **Electron will not let a guest be less isolated than its embedder**. `app/ux/WebView.js` still sets `contextIsolation=no, sandbox=no` on the tag and Electron ignores it, because the window hosting the webview is isolated. Isolating the main window silently isolated every service with it, which broke three things at once until they were moved. `window.rambox` now reaches the page through `contextBridge`. The `Notification` wrapper is injected by the panel alongside the `js_unread` snippets, because it has to patch a global in the page's own world. And a sandboxed preload cannot require Mousetrap, so Alt+Left and Alt+Right are handled in `before-input-event` in the main process.

`@electron/remote` is gone, and so is `remoteMain`. The renderer reaches main-process APIs through named IPC: `app:getVersion`, `app:quit`, `window:show`, `media:getAccessStatus`, `media:askForAccess` and `webview:clearData`. Three things that used to cross the bridge now live entirely in main, inside the `web-contents-created` handler that filters for webviews: the Google user-agent header rewrite, `certificate-error`, and `before-input-event`, which replays a shortcut typed inside a service into the host window so the app's Mousetrap sees it. Main decides a certificate error but cannot draw the warning, so it sends `webview:certificate-error` with the webContents id and the matching panel shows it; the renderer reports each service's `trust` flag over `webview:setTrust` as the service becomes ready, since the flag lives in its localStorage.

Context menus are built in `electron/contextmenu.js`, which `main.js` attaches to the main window and to each service `webContents`. It replaces `vendor/electron-contextmenu-wrapper`, the last thing holding the remote bridge up, which drew the menu in the renderer from `app.js` and from the service preload. Two behaviours differ deliberately. The package aimed cut, copy and paste at `getCurrentWindow()`, so a click inside a service acted on the host window instead of the service; the target is now whichever `webContents` reported the click. And it copied an image by drawing it into a canvas and writing the data URL, which only worked when the server allowed the cross-origin read; `copyImageAt` does it natively. The labels stay English and untranslated, as they were. Note that a webview carries two `context-menu` listeners, not one: Electron adds its own after attach, to forward the event to the `<webview>` element as a DOM event.

`electron/tray.js` used to reach the window by injecting `ipc.send("toggleWin", false)` into the renderer, which depended on a global that `contextIsolation` removed. The handler it called only ever drove `mainWindow`, so that body is now the `toggleWindow` function in `main.js`, passed to `tray.create` and still served over IPC for the renderer's own buttons.

`disable_gpu` defaults to false. Upstream defaulted it to true on Linux, forcing software rendering on every install since the Electron 13 era; on 44 the app composites and rasterises with no artefact and no GPU process crash, so the workaround is opt-in. Anyone whose driver misbehaves turns it back on in Preferences, or in `~/.config/Redil/config.json` if the window is unusable.

The `validateMasterPassword` handler in `electron/main.js` assigns `event.returnValue` twice, so it reads like it always answers `false`. It does not. Electron dispatches the reply on the first assignment and ignores the second, so a correct password does return `true`. This was verified by calling the channel directly. Leave the redundant line alone unless you retest.

## Localization

Translations were imported from Crowdin. `npm run translations:generate` collapses a folder of CSV exports at `resources/languages/<locale>/` into a single `resources/languages/<locale>.js` that assigns into a global `locale[]` array, then deletes the folder. `index.html` injects the file for the configured locale before the app boots, which is why `locale['key']` is available at class-definition time in models and views.

The download half is gone, and it could never have run here. It called Crowdin's v1 API, which answers 301 today, through the `crowdin` package, which throws `primordials is not defined` on a modern Node, against `api.crowdin.net/api/project/rambox` -- upstream's project, which this fork does not own. So there are no CSV folders in the tree and `translations:generate` has no input: the generated `.js` files are the only source of translations there is, and a correction goes into them by hand until a Crowdin project is set up for this fork.

The API key used to sit in `languages.js` in plain text. It is still in this repository's history and in the archived upstream, so it has to be revoked on Crowdin; deleting it from the working tree does not un-leak it.

## Conventions

`.editorconfig` mandates tabs (width 2) and LF. The ExtJS sources use Sencha's leading-comma style, with the comma starting each continuation line; match the surrounding file. `.npmrc` sets `save-exact=true` and disables `package-lock`, so dependency versions are pinned literally in `package.json` and no lockfile is committed.

Two dependencies are held below their latest on purpose: `electron-store` at 8.2.0 and `is-online` at 9.0.1 are the last CommonJS releases of each, and the main process and the renderer both `require` them. `auto-launch-patched` stays because Electron's own `app.setLoginItemSettings` is still darwin and win32 only, so it cannot cover Linux.

`CONTRIBUTING.md` is upstream's and asks for `fix/xxx` or `feature/xxx` branches and no commits to the default branch, which `README.md` repeats. That was written for a project taking outside contributions; this fork has one maintainer, who works directly on `main`. Commit there rather than opening a branch per change. The rest of that file still holds, including that pull request titles carry no issue number.
