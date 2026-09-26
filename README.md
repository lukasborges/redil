<div align="center">
  <img src="./resources/Icon.png" width="128" alt="" />
  <h1>Shep</h1>
  <p>One window for the web apps you already use in the browser.</p>
</div>

<p align="center">
  <img src="./resources/screenshots/shep-1.0-light.png" width="49%" alt="Shep with five services in the rail and GitHub open, light theme" />
  <img src="./resources/screenshots/shep-1.0-dark.png" width="49%" alt="The same window in the dark theme" />
</p>

Shep keeps WhatsApp, Gmail, Slack, Teams, Claude or anything else with a web address in a rail down the left of one window, each signed in on its own, each counting what is unread. It runs on Linux and on Windows.

Its looks come from GNOME, which is where it was drawn: the icon, the palette and the dialogs follow GNOME's guidelines, and the window follows the desktop's light or dark style on either system. On Windows the title bar carries the system's own buttons, and the notification area takes the coloured mark rather than the flat one a GNOME panel asks for.

## How it works

Press `+` and pick a service from the list, or type any address; either way, that is the service. The list only fills in a name and an address, and a service picked from it is the same as one typed in.

- **Every service works the same way.** Nothing in Shep knows one site from another, so there are no per-service scripts to go stale when a site changes. The one exception is Google's sign-in, which turns away a browser that states its Chrome version, so the request that carries it leaves the version out.
- **The icon is the page's favicon**, as the page itself shows it. A service that marks news by changing its favicon, like Google Chat, shows it in the rail that way.
- **The unread count comes from the page title**, the `(3)` most web apps put in front of it. A title that says there is something without a number, `(•)`, draws a dot.
- **Links stay in the app.** A link to another site opens in a window of Shep's that shares the service's session, so it is already signed in. When a sign-in there finishes back on the service, the window closes and the service carries on. Open Link in Browser is on the right click.
- **Pages see a browser**: the Chromium Shep is built on, with nothing of Shep or Electron in its user agent, which is what sign-ins and captchas check for.
- **The page in view is driven from the title bar**: back, forward, reload, home to the address it was added with, and find. A zoom other than 100% shows there too, and a click puts it back.
- **The service itself is on its right click in the rail**: reload, notifications, sound, disable, edit, move to a workspace, remove.

Services can be grouped into **workspaces**, one on screen at a time, switched from the top of the rail. The ones out of sight keep running, counting and notifying, and the switcher shows a dot when one of them has something new.

Shep also has a do-not-disturb switch, a lock screen with a password, an icon in the system tray, spell checking, screen sharing through the desktop's own picker on Wayland and through Shep's own everywhere else, and a report of what each service's title says, for when a count looks wrong. It speaks English, Portuguese, Spanish, French, German, Italian, Russian, Japanese, Chinese and Korean.

## Install

[Releases](https://github.com/lukasborges/shep/releases) carry an AppImage, a deb and a tarball for x86-64 Linux, and an installer and a zip for x86-64 Windows. Shep updates itself from those releases.

### Linux

The AppImage needs FUSE 2, which some distributions no longer install by default: `fuse-libs` on Fedora, `libfuse2t64` on Ubuntu 24.04 and later, `libfuse2` on Debian. Without it, run the AppImage with `--appimage-extract-and-run`.

### Windows

The installer writes to your own account, `%LOCALAPPDATA%\Programs\Shep`, and asks no administrator for anything; the zip is the same app with nothing to install. Windows 10 or 11.

Neither is signed, because a certificate costs money this app does not have. The first run of either one meets SmartScreen: **More info**, then **Run anyway**. For the zip, ticking **Unblock** in the downloaded file's properties before extracting settles it for every file inside at once. Nothing an installer can do changes this, since the warning is about the missing signature rather than about what is installed.

Shep 1.0 is a new app and starts from a clean profile. Services added in 0.10 have to be added again.

## Keyboard

| Keys | |
|---|---|
| `Ctrl+1` … `Ctrl+9` | The first nine services in the rail |
| `Ctrl+Tab`, `Ctrl+Shift+Tab` | The next and the previous service |
| `Ctrl+Alt+1` … `Ctrl+Alt+9` | A workspace, the number after the last being all services |
| `Alt+←`, `Alt+→` | Back and forward in the page |
| `Ctrl+R`, `F5` | Reload, and `Ctrl+Shift+R` without the cache |
| `Ctrl+F` | Find in page |
| `Ctrl+=`, `Ctrl+-`, `Ctrl+0` | Zoom in, out, back to actual size |
| `Ctrl+N` | Add a service |
| `Ctrl+,` | Preferences |
| `Alt+Shift+D` | Do not disturb |
| `Alt+Shift+L` | Lock |
| `F11` | Full screen |
| `Ctrl+Q` | Quit |

## Privacy

There is no account and no server. Shep keeps your services, workspaces and preferences in `~/.config/Shep/shep.json`, on Windows `%APPDATA%\Shep\shep.json`, and each service keeps its own session beside it, so you stay signed in until you remove the service, which deletes its session too.

Shep sends nothing about you anywhere. It makes two requests of its own: the update check, to this repository's releases on GitHub, and the download of a spell-checking dictionary the first time a language needs one, which Chromium fetches from Google. What each service does is up to the service: Shep is a frame around its web app and does not look inside.

Camera, microphone and screen sharing are asked about once per service and the answer is remembered. Notifications follow the service's own switch, and a few that expose nothing, such as going full screen, are granted. Every other permission a page asks for is refused.

The lock password is stored as a salted scrypt hash. The lock hides the window's contents; it does not encrypt the sessions on disk.

## Development

Node 22 or later and npm.

```bash
npm install
npm start               # the app, with the interface reloading as you edit
npm test                # typecheck, lint, build, unit tests, then the end-to-end suite
npm run package         # the packages for the system you are on, into dist/
```

`npm run package` builds what that system can build: on Linux the AppImage, the deb and the tarball, on Windows the installer and the zip. Neither builds the other's.

A run from the repository uses its own profile, `~/.config/Shep-dev`, on Windows `%APPDATA%\Shep-dev`, and never touches the installed app's.

The end-to-end suite launches the real app, so it opens windows. On Linux, with `xvfb-run` installed, it opens them on a virtual display instead of your desktop; one test also needs `xdotool`, and skips itself where there is none. On Fedora that is `dnf install xorg-x11-server-Xvfb xdotool`. Windows has no such thing, so the windows open on your desktop and take the focus while the suite runs. `npm run test:network` adds the tests that load real sites, such as the one that renders a Cloudflare captcha.

If Electron aborts at start with a sandbox error, as it does on Ubuntu 24.04, the distribution keeps unprivileged user namespaces from Chromium's sandbox. Pass `--no-sandbox`, which is what the packaged builds do.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before sending a change.

## Credits

Shep began as a fork of [Rambox Community Edition](https://github.com/ramboxapp/community-edition), archived in 2022, and 1.0 is a rewrite that keeps its name and none of its code. The idea that every service should work the same way comes from [ElectronIM](https://github.com/manusa/electronim). The workspace icons are from [Lucide](https://lucide.dev).

Shep is not affiliated with any of the services it opens.

## Licence

[GNU GPL v3](./LICENSE).
