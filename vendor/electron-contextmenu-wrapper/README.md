# electron-contextmenu-wrapper

![](https://img.shields.io/npm/dm/electron-contextmenu-wrapper.svg)
[![](https://img.shields.io/david/TheGoddessInari/electron-contextmenu-wrapper.svg)](https://david-dm.org/TheGoddessInari/electron-contextmenu-wrapper)

electron-contextmenu-wrapper was forked from electron-spellchecker to provide
a robust context handling library that's also callable from inside of a webview preloader.

## Quick Start

```js
const {ContextMenuListener, ContextMenuBuilder} = require('electron-contextmenu-wrapper');

let contextMenuBuilder = new ContextMenuBuilder();
let contextMenuListener = new ContextMenuListener((event, info) => {
  contextMenuBuilder.showPopupMenu(info);
});
```

Additionally, there are
```js
ContextMenuBuilder.prependContextMenuItem(new MenuItem(label: "Work!"))
```
 and
 ```js
 ContextMenuBuilder.appendContextMenuItem(new MenuItem(label: "Smarter!"))
 ```
to customize the context menus.

## Learning more

* Run `npm start` to start [the example application](https://github.com/TheGoddessInari/electron-contextmenu-wrapper/tree/master/example) and play around.

