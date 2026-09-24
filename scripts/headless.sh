#!/bin/sh
# Opens the test windows on a virtual X display instead of the desktop, where they take the focus.
# ozone-platform-hint=auto picks Wayland while XDG_SESSION_TYPE says wayland, even with no WAYLAND_DISPLAY.
if command -v xvfb-run >/dev/null 2>&1; then
	exec env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 xvfb-run --auto-servernum --server-args='-screen 0 1280x1024x24' "$@"
fi
echo "xvfb-run is not installed, so the windows open on this desktop (Fedora: dnf install xorg-x11-server-Xvfb)" >&2
exec "$@"
