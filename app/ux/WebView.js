/**
 * Default config for all webviews created
 */

Ext.define('Shep.ux.WebView',{
	 extend: 'Ext.panel.Panel'
	,xtype: 'webview'

	,requires: [
		 'Shep.util.Format'
		,'Shep.util.UnreadCounter'
		,'Shep.util.Workspaces'
		,'Shep.util.ServiceIcon'
	]

	// private
	,currentUnreadCount: 0

	// CONFIG
	,hideMode: 'offsets'
	// the service runs edge to edge; a hairline around somebody else's page
	// only framed it
	,border: false
	,bodyBorder: false
	,initComponent: function(config) {
		var me = this;

		function getLocation(href) {
			var match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)(\/[^?#]*)(\?[^#]*|)(#.*|)$/);
			return match && {
				protocol: match[1],
				host: match[2],
				hostname: match[3],
				port: match[4],
				pathname: match[5],
				search: match[6],
				hash: match[7]
			}
		}

		Ext.apply(me, {
			 items: me.webViewConstructor()
			// The rail shows icons only, so the name lives in the tooltip. The
			// hide_tabbar_labels preference and the per-service tabname option both
			// went with the labels they used to govern.
			,title: ''
			,tooltip: me.record.get('name')
			,icon: Shep.util.ServiceIcon.describe(me.record).url
			,src: me.record.get('url')
			,type: me.record.get('type')
			,align: me.record.get('align')
			,notifications: me.record.get('notifications')
			,muted: me.record.get('muted')
			,tabConfig: {
				listeners: {
					afterrender : function( btn ) {
						btn.el.on('contextmenu', function(e) {
							btn.showMenu('contextmenu');
							e.stopEvent();
						});
					}
					,scope: me
				}
				,clickEvent: ''
				,cls: Shep.util.ServiceIcon.describe(me.record).cls
				,style: !me.record.get('enabled') ? '-webkit-filter: grayscale(1)' : ''
				,menu:  {
					 plain: true
					,listeners: {
						 beforeshow: me.syncServiceMenu
						,scope: me
					}
					/*
					 * Grouped by what is acted on: the page, then the switches, then
					 * the service, with the developer tools last. A disabled service
					 * has no page, so syncServiceMenu hides what is marked needsPage,
					 * separators included, and the switches and the service stay.
					 */
					,items: [
						{
							 xtype: 'toolbar'
							,needsPage: true
							,items: [
								{
									 xtype: 'segmentedbutton'
									,allowToggle: false
									,flex: 1
									,items: [
										{
											 text: 'Back'
											,glyph: 'xf053@FontAwesome'
											,flex: 1
											,scope: me
											,handler: me.goBack
										}
										,{
											 text: 'Forward'
											,glyph: 'xf054@FontAwesome'
											,iconAlign: 'right'
											,flex: 1
											,scope: me
											,handler: me.goForward
										}
									]
								}
							]
						}
						,{
							// the three zoom commands as one row, the way a browser's
							// menu has it; the percentage resets
							 xtype: 'toolbar'
							,needsPage: true
							,items: [
								{
									 xtype: 'segmentedbutton'
									,allowToggle: false
									,flex: 1
									,items: [
										{
											 glyph: 'xf068@FontAwesome'
											,tooltip: 'Zoom Out'
											,flex: 1
											,scope: me
											,handler: me.zoomOut
										}
										,{
											 itemId: 'zoomReset'
											,text: '100%'
											,tooltip: 'Reset Zoom'
											,flex: 1
											,scope: me
											,handler: me.resetZoom
										}
										,{
											 glyph: 'xf067@FontAwesome'
											,tooltip: 'Zoom In'
											,flex: 1
											,scope: me
											,handler: me.zoomIn
										}
									]
								}
							]
						}
						,{
							 text: locale['app.webview[0]']
							,needsPage: true
							,glyph: 'xf021@FontAwesome'
							,scope: me
							,handler: me.reloadService
						}
						,{ xtype: 'menuseparator', needsPage: true }
						/*
						 * Switched on and off from day to day, so they live here
						 * rather than in the Edit window. Anything that is switched
						 * wears the switch: one item per position, and the menu shows
						 * the one that is true as it opens.
						 */
						,{ text: 'Notifications', itemId: 'notificationsOn', glyph: 'xf205@FontAwesome', scope: me, handler: me.toggleNotificationsFromMenu }
						,{ text: 'Notifications', itemId: 'notificationsOff', glyph: 'xf204@FontAwesome', scope: me, handler: me.toggleNotificationsFromMenu }
						,{ text: 'Sound', itemId: 'soundOn', glyph: 'xf205@FontAwesome', scope: me, handler: me.toggleSoundFromMenu }
						,{ text: 'Sound', itemId: 'soundOff', glyph: 'xf204@FontAwesome', scope: me, handler: me.toggleSoundFromMenu }
						,{ text: 'Enabled', itemId: 'disableService', glyph: 'xf205@FontAwesome', scope: me, handler: me.toggleService }
						,{ text: 'Enabled', itemId: 'enableService', glyph: 'xf204@FontAwesome', scope: me, handler: me.toggleService }
						,'-'
						,{
							 text: locale['app.window[1]']
							,glyph: 'xf013@FontAwesome'
							,scope: me
							,handler: me.editService
						}
						,{
							// filled as the menu opens; hidden until there is a workspace
							 text: 'Move to workspace'
							,itemId: 'moveToWorkspace'
							,glyph: 'xf0ec@FontAwesome'
							,menu: { plain: true, items: [] }
						}
						,{
							 text: locale['app.main[14]']
							,glyph: 'xf1f8@FontAwesome'
							,scope: me
							,handler: me.removeService
						}
						,{ xtype: 'menuseparator', needsPage: true }
						,{
							 text: 'Developer Tools'
							,needsPage: true
							,glyph: 'xf121@FontAwesome'
							,scope: me
							,handler: me.toggleDevTools
						}
					]
				}
			}
			,tbar: {
				 itemId: 'searchBar'
				,hidden: true
				,items: ['->', {
					 xtype: 'textfield'
					,emptyText: 'Search...'
					,listeners: {
						 scope: me
						,change: me.doSearchText
						,specialkey: function(field, e) {
							if ( e.getKey() === e.ENTER ) return me.doSearchText(field, field.getValue(), null, null, true)
							if ( e.getKey() === e.ESC ) return me.showSearchBox(false)
						}
					}
				}, {
					 xtype: 'displayfield'
				}, {
					 xtype: 'segmentedbutton'
					,allowMultiple: false
					,allowToggle: false
					,items: [{
						 glyph: 'xf053@FontAwesome'
						,handler: function() {
							var field = this.up('toolbar').down('textfield');
							me.doSearchText(field, field.getValue(), null, null, false)
						}
					}, {
						 glyph: 'xf054@FontAwesome'
						,handler: function() {
							var field = this.up('toolbar').down('textfield');
							me.doSearchText(field, field.getValue(), null, null, true)
						}
					}]
				}, {
					 xtype: 'button'
					,glyph: 'xf00d@FontAwesome'
					,handler: function() { me.showSearchBox(false) }
				}]
			}
			,listeners: {
				 afterrender: me.onAfterRender
				,beforedestroy: me.onBeforeDestroy
			}
		});

		// The status bar floats in the corner and shows only while there is
		// something to say, the way a browser's does. A strip docked under the
		// page saying "Ready" for ever was the loudest piece of chrome left, so the
		// per-service "Always display Status Bar" went with it; the record keeps
		// the field and nothing reads it. A disabled service has no page to
		// report on; setEnabled adds the bar along with the page.
		if ( me.record.get('enabled') ) me.items.push(me.statusBarConstructor());

		me.callParent(config);
	}

	,onBeforeDestroy: function() {
		var me = this;

		me.setUnreadCount(0);
	}

	,webViewConstructor: function( enabled ) {
		var me = this;

		var cfg;
		enabled = enabled || me.record.get('enabled');

		if ( !enabled ) {
			cfg = {
				 xtype: 'component'
				,cls: 'rx-disabled'
				,html: [
					 '<img src="' + Ext.String.htmlEncode(me.icon) + '" alt="">'
					,'<h2>' + Ext.String.htmlEncode(me.record.get('name')) + '</h2>'
					,'<p>' + locale['app.service[2]'] + '</p>'
					,'<button type="button" class="rx-enable">' + locale['app.service[1]'] + '</button>'
				].join('')
				,listeners: {
					 click: { element: 'el', delegate: '.rx-enable', fn: function() { me.toggleService(); } }
				}
			};
		} else {
			cfg = [{
				 xtype: 'component'
				,cls: 'webview'
				,hideMode: 'offsets'
				,autoRender: true
				,autoShow: true
				,autoEl: {
					 tag: 'webview'
					,src: me.record.get('url')
					,style: 'width:100%;height:100%;visibility:visible;'
					,partition: 'persist:' + me.record.get('type') + '_' + me.id.replace('tab_', '')
					,plugins: 'true'
					,allowtransparency: 'on'
					,autosize: 'on'
					// Electron ignores the last two -- a guest cannot be less isolated
					// than its embedder -- and honours the first, which is why the
					// preference is read here rather than assumed.
					,webpreferences: 'spellcheck=' + (ipc.sendSync('getConfig').spellcheck ? 'yes' : 'no') + ', contextIsolation=no, sandbox=no'
					,allowpopups: 'on'
					// ,disablewebsecurity: 'on' // Disabled because some services (Like Google Drive) dont work with this enabled
					,preload: new URL('resources/js/rambox-service-api.js', window.location.href).href
				}
			}];
		}

		return cfg;
	}
	,statusBarConstructor: function() {
		var me = this;

		return {
			 xtype: 'statusbar'
			,id: me.id+'statusbar'
			// Ext gives x-statusbar only to a docked bar, and the theme's rules key on it
			,cls: Ext.baseCSSPrefix + 'statusbar rx-status'
			,hidden: true
			// kept on screen by a warning, until it is dismissed
			,keep: false
			,height: 22
			,defaultText: ''
			,busyIconCls : ''
			,busyText: '<i class="fa fa-circle-o-notch fa-spin fa-fw"></i> '+locale['app.webview[4]']
			,items: [
				{
					 xtype: 'tbtext'
					,itemId: 'url'
				}
				,{
					 xtype: 'button'
					,glyph: 'xf00d@FontAwesome'
					,scale: 'small'
					,ui: 'decline'
					,padding: 0
					,scope: me
					,hidden: true
					,handler: me.closeStatusBar
					,tooltip: {
						 text: 'Dismiss'
						,mouseOffset: [0,-60]
					}
				}
				,{
					// A certificate is trusted where the question comes up, rather
					// than from a setting in the Edit window ahead of time.
					 xtype: 'button'
					,itemId: 'trust'
					,text: 'Trust this certificate'
					,scale: 'small'
					,ui: 'decline'
					,scope: me
					,hidden: true
					,handler: me.trustCertificate
				}
			]
		};
	}

	,onAfterRender: function() {
		var me = this;

		if ( !me.record.get('enabled') ) return;

		var webview = me.getWebView();
		me.errorCodeLog = []

		// Notifications in Webview
		me.setNotifications(localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb')) ? false : me.record.get('notifications'));

		// Show and hide spinner when is loading
		webview.addEventListener("did-start-loading", function() {
			console.info('Start loading...', me.src);

			me.down('statusbar').show();
			me.down('statusbar').showBusy();
		});

		webview.addEventListener("did-stop-loading", function() {
			me.down('statusbar').clearStatus({useDefaults: true});
			me.syncStatusBar();
		});

		webview.addEventListener("did-finish-load", function(e) {
			Shep.app.setTotalServicesLoaded( Shep.app.getTotalServicesLoaded() + 1 );

			// Apply saved zoom level
			webview.setZoomLevel(me.record.get('zoomLevel'));

			// Fix cursor sometimes dissapear
			let currentTab = Ext.cq1('app-main').getActiveTab();
			if ( currentTab.id === me.id ) {
				webview.blur();
				webview.focus();
			}
		});

		// On search text
		webview.addEventListener('found-in-page', function(e) {
			me.onSearchText(e.result)
		});

		// On search text
		webview.addEventListener('did-fail-load', function(e) {
			console.info('The service fail at loading', me.src, e);

			if ( me.record.get('disableAutoReloadOnFail') || !e.isMainFrame ) return
			me.errorCodeLog.push(e.errorCode)

			var attempt = me.errorCodeLog.filter(function(code) { return code === e.errorCode });

			// Error codes: https://cs.chromium.org/chromium/src/net/base/net_error_list.h
			var msg = []
			msg[-2] = 'NET error: failed.'
			msg[-3] = 'An operation was aborted (due to user action)'
			msg[-7] = 'Connection timeout.'
			msg[-21] = 'Network change.'
			msg[-100] = 'The connection was reset. Check your internet connection.'
			msg[-101] = 'The connection was reset. Check your internet connection.'
			msg[-105] = 'Name not resolved. Check your internet connection.'
			msg[-106] = 'There is no active internet connection.'
			msg[-118] = 'Connection timed out. Check your internet connection.'
			msg[-130] = 'Proxy connection failed. Please, check the proxy configuration.'
			msg[-300] = 'The URL is invalid.'
			msg[-324] = 'Empty response. Check your internet connection.'

			switch ( e.errorCode ) {
				case 0:
					break
				case -3: // An operation was aborted (due to user action) I think that gmail an other pages that use iframes stop some of them making this error fired
					if ( attempt.length <= 4 ) return
					setTimeout(() => me.reloadService(me), 200);
					me.errorCodeLog = []
					break;
				case -2:
				case -7:
				case -21:
				case -118:
				case -324:
				case -100:
				case -101:
				case -105:
					attempt.length > 4 ? me.onFailLoad(msg[e.errorCode]) : setTimeout(() => me.reloadService(me), 2000);
					break;
				case -106:
					me.onFailLoad(msg[e.errorCode])
					break;
				case -130:
					// Could not create a connection to the proxy server. An error occurred
					// either in resolving its name, or in connecting a socket to it.
					// Note that this does NOT include failures during the actual "CONNECT" method
					// of an HTTP proxy.
				case -300:
					attempt.length > 4 ? me.onFailLoad(msg[e.errorCode]) : me.reloadService(me);
					break;
			}
		});

		// Links that open a window are decided in the main process, by the
		// setWindowOpenHandler installed on this webview's webContents.
		// The 'new-window' DOM event this used to listen to no longer exists.

		webview.addEventListener('will-navigate', function(e, url) {
			e.preventDefault();
		});

		webview.addEventListener("dom-ready", function(e) {
			// Mute Webview
			if ( me.record.get('muted') || localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb')) ) me.setAudioMuted(true, true);

			var js_inject = '';

			// Wraps Notification so clicking one brings the window forward and
			// activates this tab. The preload used to patch the global directly;
			// it now runs in an isolated world, so this has to be injected, which
			// puts it in the page's own world.
			js_inject += 'if(!window.__ramboxNotification&&window.rambox){window.__ramboxNotification=true;'
				+ 'var __native=Notification;'
				+ 'window.Notification=function(t,o){var n=new __native(t,o);'
				+ 'n.addEventListener("click",function(){window.rambox.showWindowAndActivateTab()});'
				// Gmail checks that these exist before using notifications, so they
				// are replaced by something that always says yes.
				+ 'n.addEventListener=function(){return true};'
				+ 'n.attachEvent=function(){return true};'
				+ 'n.addListener=function(){return true};'
				+ 'return n};'
				+ 'window.Notification.prototype=__native.prototype;'
				+ 'window.Notification.permission=__native.permission;'
				+ 'window.Notification.requestPermission=__native.requestPermission.bind(__native);'
				// Electron never displays a notification a service worker shows,
				// and Google Chat sends its messages that way, so they vanished.
				// They become page notifications; actions are dropped because the
				// constructor throws on them outside a service worker.
				+ 'if(window.ServiceWorkerRegistration){'
				+ 'ServiceWorkerRegistration.prototype.showNotification=function(t,o){'
				+ 'var p=Object.assign({},o);delete p.actions;'
				+ 'try{new window.Notification(t,p)}catch(e){return Promise.reject(e)}'
				+ 'return Promise.resolve()};'
				+ 'ServiceWorkerRegistration.prototype.getNotifications=function(){return Promise.resolve([])};}}';

			// Scroll always to top (bug)
			js_inject += 'document.body.scrollTop=0;';

			// Handles Certificate Errors. Whether to accept one is decided in the
			// main process, which owns this webContents but cannot reach the
			// status bar, so it reports back here to have the warning drawn.
			ipc.send('webview:setTrust', webview.getWebContentsId(), me.record.get('trust'));

			// Camera, microphone and screen sharing without a prompt, for the
			// services that exist to make calls. Reported from here for the same
			// reason as the trust flag: it lives in this side's localStorage.
			me.setMediaAccess(me.mediaAccess());
			if (!me.certificateWarning) {
				me.certificateWarning = function(event, webContentsId) {
					if (webContentsId !== webview.getWebContentsId()) return;

					me.showStatusWarning('<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Certification Warning');
					me.down('statusbar #trust').show();
				};
				ipc.on('webview:certificate-error', me.certificateWarning);
				me.on('destroy', function() { ipc.removeListener('webview:certificate-error', me.certificateWarning); });
			}
			webview.executeJavaScript(js_inject).catch(err => console.log(err));
		});

		webview.addEventListener('ipc-message', function(event) {
			if ( event.channel === 'rambox.showWindowAndActivateTab' ) showWindowAndActivateTab();

			function showWindowAndActivateTab() {
				ipc.send('window:show');
				var tabPanel = Ext.cq1('app-main');
				// Temp fix missing cursor after upgrade to electron 3.x +
				tabPanel.setActiveTab(me);
				tabPanel.getActiveTab().getWebView().blur();
				tabPanel.getActiveTab().getWebView().focus();
			}
		});

		// The title is the one count every service gives: "(3) Inbox".
		webview.addEventListener("page-title-updated", function(e) {
			me.pageTitle = e.title;
			me.syncTitleBarIfActive();
			me.reportTitleUnread(me.countFromTitle(e.title));
		});

		// back and forward in the title bar follow the page's own history
		webview.addEventListener('did-navigate-in-page', function() { me.syncTitleBarIfActive(); });
		webview.addEventListener('did-navigate', function() { me.syncTitleBarIfActive(); });

		webview.addEventListener('page-favicon-updated', function( e ) {
			me.wearFavicon(e.favicons);
		});

		webview.addEventListener('update-target-url', function( url ) {
			me.hoveredURL = url.url;
			me.down('statusbar #url').setText(Ext.String.htmlEncode(url.url));
			me.syncStatusBar();
		});
	}

	/**
	 * What the unread report shows for this service: the title it last read and
	 * the count it took from it. Testing detection means logging into the
	 * service, so the least the app can do is say what it sees.
	 */
	,unreadDiagnosis: function() {
		var me = this;

		return {
			 name: me.record.get('name')
			,title: me.pageTitle || '—'
			,total: String(me.countOf(me.currentUnreadCount))
		};
	}

	/**
	 * How many a count stands for, with '•' meaning "some, and the service is not
	 * saying how many".
	 */
	,countOf: function(value) {
		if ( value === '•' ) return 1;
		var number = parseInt(value, 10);
		return isNaN(number) ? 0 : number;
	}

	/**
	 * The count a title carries, in the shape browsers made common: "(3) Inbox",
	 * or failing that a "(3)" anywhere, as in "Inbox (3) - someone@gmail.com".
	 * "(1.234)" and "(99+)" count their digits, and "(•)" is '•'.
	 */
	,countFromTitle: function(title) {
		var match = /^\s*\(\s*(•|\d[\d.,+]*)\s*\)/.exec(title || '') || /\(\s*(•|\d[\d.,+]*)\s*\)/.exec(title || '');
		if ( !match ) return 0;
		if ( match[1] === '•' ) return '•';
		return parseInt(match[1].match(/\d+/g).join(''), 10);
	}

	/**
	 * Some services blink their title, putting the count back a moment after
	 * taking it away, so a drop to nothing only counts once it has lasted.
	 */
	,reportTitleUnread: function(count) {
		var me = this;

		clearTimeout(me.titleDropTimer);
		if ( me.countOf(count) === 0 && me.countOf(me.currentUnreadCount) > 0 ) {
			me.titleDropTimer = setTimeout(function() {
				if ( !me.isDestroyed ) me.setUnreadCount(0);
			}, me.titleBlinkGrace);
			return;
		}
		me.setUnreadCount(count);
	}

	,titleBlinkGrace: 1500

	,setUnreadCount: function(newUnreadCount) {
		var me = this;

		if ( !isNaN(newUnreadCount) && (function(x) { return (x | 0) === x; })(parseFloat(newUnreadCount)) && me.record.get('includeInGlobalUnreadCounter') === true) {
			Shep.util.UnreadCounter.setUnreadCountForService(me.record.get('id'), newUnreadCount);
		} else {
			Shep.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
		}

		// '•' is a service saying there is something without saying how much. It
		// is not a number, so it stays out of the total and is remembered apart.
		Shep.util.UnreadCounter.setSomethingUnreadForService(me.record.get('id'), newUnreadCount === '•');
		// the switcher's dot, for a count in a workspace that is not on screen
		Shep.util.Workspaces.refreshSwitcher();

		me.setTabBadgeText(Shep.util.Format.formatNumber(newUnreadCount));
		me.currentUnreadCount = newUnreadCount;
	}

	,refreshUnreadCount: function() {
		this.setUnreadCount(this.currentUnreadCount);
	}

	/**
	 * Sets the tab badge text depending on the service config param "displayTabUnreadCounter".
	 *
	 * @param {string} badgeText
	 */
	,setTabBadgeText: function(badgeText) {
		var me = this;
		if (me.record.get('displayTabUnreadCounter') === true) {
			me.tab.setBadgeText(badgeText);
		} else {
			me.tab.setBadgeText('');
		}
	}

	/**
	 * Clears the unread counter for this view:
	 * • clears the badge text
	 * • clears the global unread counter
	 */
	,clearUnreadCounter: function() {
		var me = this;
		me.tab.setBadgeText('');
		Shep.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
	}

	,reloadService: function(btn) {
		var me = this;
		var webview = me.getWebView();

		if ( me.record.get('enabled') ) {
			me.clearUnreadCounter();
			webview.loadURL(me.src);
		}
	}

	,onFailLoad: function(v) {
		let me = this
		me.errorCodeLog = []
		setTimeout(() => me.showStatusWarning('<i class="fa fa-warning fa-fw" aria-hidden="true"></i> The service failed at loading, Error: '+ v), 1000);
	}

	,showSearchBox: function(v) {
		var me = this;
		if ( !me.record.get('enabled') ) return;
		var webview = me.getWebView();

		webview.stopFindInPage('keepSelection');
		if ( v ) {
			me.down('#searchBar').show();
			setTimeout(() => { me.down('#searchBar textfield').focus() }, 100)
		} else {
			me.down('#searchBar').hide();
			me.down('#searchBar textfield').setValue('');
		}

		me.down('#searchBar displayfield').setValue('');
	}

	,doSearchText: function(field, newValue, oldValue, eOpts, forward = true) {
		var me = this;
		var webview = me.getWebView();

		if ( newValue === '' ) {
			webview.stopFindInPage('clearSelection');
			me.down('#searchBar displayfield').setValue('');
			return;
		}

		webview.findInPage(newValue, {
			forward: forward,
			findNext: false,
			matchCase: false
		})
	}

	,onSearchText: function( result ) {
		var me = this;

		me.down('#searchBar displayfield').setValue(result.activeMatchOrdinal+ '/' + result.matches);
	}

	,toggleDevTools: function(btn) {
		var me = this;
		var webview = me.getWebView();

		if ( me.record.get('enabled') ) webview.isDevToolsOpened() ? webview.closeDevTools() : webview.openDevTools();
	}

	,setURL: function(url) {
		var me = this;
		var webview = me.getWebView();

		me.src = url;

		if ( me.record.get('enabled') ) webview.loadURL(url);
	}

	,setAudioMuted: function(muted, calledFromDisturb) {
		var me = this;
		var webview = me.getWebView();

		me.muted = muted;

		if ( !muted && !calledFromDisturb && JSON.parse(localStorage.getItem('dontDisturb')) ) return;

		// Before dom-ready the page cannot be muted yet; dom-ready applies the
		// record's setting when it arrives.
		try {
			if ( me.record.get('enabled') ) webview.setAudioMuted(muted);
		} catch (e) {}
	}

	// A warning stays until it is dismissed, which is what the button is for.
	,showStatusWarning: function(text) {
		var statusbar = this.down('statusbar');

		statusbar.keep = true;
		statusbar.setStatus({ text: text });
		statusbar.down('button').show();
		statusbar.show();
	}

	,closeStatusBar: function() {
		var statusbar = this.down('statusbar');

		statusbar.keep = false;
		statusbar.down('button').hide();
		statusbar.down('#trust').hide();
		statusbar.clearStatus({ useDefaults: true });
		this.syncStatusBar();
	}

	,trustCertificate: function() {
		var me = this;

		me.record.set('trust', true);
		ipc.send('webview:setTrust', me.getWebView().getWebContentsId(), true);
		me.closeStatusBar();
		me.reloadService();
	}

	// Shown while the page loads, while the pointer is over a link, or while a
	// warning is waiting; hidden the rest of the time.
	,syncStatusBar: function() {
		var me = this;
		var statusbar = me.down('statusbar');
		var loading = me.record.get('enabled') && me.getWebView().isLoading && me.getWebView().isLoading();

		statusbar.setVisible(!!(statusbar.keep || loading || me.hoveredURL));
	}

	,setNotifications: function(notification, calledFromDisturb) {
		var me = this;
		var webview = me.getWebView();

		me.notifications = notification;

		if ( notification && !calledFromDisturb && JSON.parse(localStorage.getItem('dontDisturb')) ) return;

		if ( me.record.get('enabled') ) ipc.send('setServiceNotifications', webview.partition, notification);
	}

	/**
	 * Whether this service is allowed the camera and the microphone without being
	 * asked. Only a record that says so is; any other service is asked once, and
	 * the answer is remembered.
	 */
	,mediaAccess: function() {
		return this.record.get('media') === true;
	}

	/**
	 * Whether this service gets the camera, the microphone and screen sharing
	 * without being asked. Main keeps the answer per session partition and its
	 * permission handler reads it; nothing is remembered for a service that is
	 * turned off, which has no session of its own running.
	 */
	,setMediaAccess: function(allowed) {
		var me = this;
		var webview = me.getWebView();

		if ( me.record.get('enabled') && webview ) ipc.send('service:setMediaAccess', webview.partition, allowed);
	}

	/*
	 * A disabled service has no page, so going back, zooming or reloading have
	 * nothing to act on, and the menu keeps only what can be done to the
	 * service itself.
	 */
	,syncServiceMenu: function( menu ) {
		var ligado = this.record.get('enabled');

		Ext.each(menu.items.items, function(item) {
			if ( item.needsPage ) item.setHidden(!ligado);
		});
		this.syncZoomLabel(menu);
		menu.down('#disableService').setHidden(!ligado);
		menu.down('#enableService').setHidden(ligado);
		var notifications = this.record.get('notifications');
		var sound = !this.record.get('muted');
		menu.down('#notificationsOn').setHidden(!notifications);
		menu.down('#notificationsOff').setHidden(notifications);
		menu.down('#soundOn').setHidden(!sound);
		menu.down('#soundOff').setHidden(sound);
		this.syncWorkspaceMenu(menu.down('#moveToWorkspace'));
	}

	,toggleNotificationsFromMenu: function() {
		var on = !this.record.get('notifications');
		this.record.set('notifications', on);
		this.setNotifications(on);
	}

	,toggleSoundFromMenu: function() {
		var muted = !this.record.get('muted');
		this.record.set('muted', muted);
		this.setAudioMuted(muted);
	}

	/*
	 * The workspaces, with this service's own ticked, and None for every one.
	 * Moving it out of the workspace on screen takes it off the rail, and the
	 * rail moves on to the next service if this one was open.
	 */
	,syncWorkspaceMenu: function( item ) {
		var me = this;
		var workspaces = Shep.util.Workspaces;
		var list = workspaces.list();
		var current = me.record.get('workspace');

		item.setHidden(Ext.isEmpty(list));
		if ( Ext.isEmpty(list) ) return;

		var move = function(id) {
			me.record.set('workspace', id);
			workspaces.apply();
		};
		var entries = list.map(function(workspace) {
			return {
				 text: workspaces.chip(workspace) + Ext.String.htmlEncode(workspace.name)
				,checked: workspace.id === current
				,group: 'moveToWorkspace'
				,handler: function() { move(workspace.id); }
			};
		});
		entries.push('-', {
			 text: 'All'
			,checked: !current
			,group: 'moveToWorkspace'
			,handler: function() { move(''); }
		});

		Ext.suspendLayouts();
		item.menu.removeAll();
		item.menu.add(entries);
		Ext.resumeLayouts(true);
	}

	,mainController: function() {
		return Ext.cq1('app-main').getController();
	}

	,editService: function() {
		this.mainController().configureService(null, null, null, null, null, this.record);
	}

	,toggleService: function() {
		this.mainController().toggleService(this.record);
	}

	,removeService: function() {
		this.mainController().removeService(null, null, null, null, null, this.record);
	}

	,setEnabled: function(enabled) {
		var me = this;

		me.clearUnreadCounter();

		me.removeAll();
		me.add(me.webViewConstructor(enabled));
		if ( enabled ) me.add(me.statusBarConstructor());
		if ( enabled ) {
			me.resumeEvent('afterrender');
			me.show();
			me.tab.setStyle('-webkit-filter', 'grayscale(0)');
			me.onAfterRender();
		} else {
			me.suspendEvent('afterrender');
			me.tab.setStyle('-webkit-filter', 'grayscale(1)');
		}
	}

	/**
	 * Wears the favicon the page lists, live, fetched through the service's
	 * session and kept on the record, so the rail shows it again before the page
	 * loads. Services that mark something new by swapping their favicon, as
	 * Google Chat and Meet do, show it in the rail this way.
	 */
	,wearFavicon: function( favicons ) {
		var me = this;
		if ( me.isDestroyed || !Ext.isArray(favicons) || !favicons.length ) return;

		var webContentsId;
		try {
			webContentsId = me.getWebView().getWebContentsId();
		} catch (e) {
			return; // the page went away before its favicon arrived
		}

		var request = me.faviconRequest = (me.faviconRequest || 0) + 1;
		ipc.invoke('favicon:fetch', webContentsId, favicons)
			.then(Shep.util.ServiceIcon.pickFavicon)
			.then(function( favicon ) {
				if ( !favicon || request !== me.faviconRequest || me.isDestroyed ) return;
				me.setIcon(favicon);
				me.tab.addCls(Shep.util.ServiceIcon.FAVICON_CLS);
				me.syncTitleBarIfActive();
				if ( me.record.get('favicon') !== favicon ) me.record.set('favicon', favicon);
			})
			.catch(function( err ) { console.log(err); });
	}

	,syncTitleBarIfActive: function() {
		var me = this;
		// deferred: the navigation events arrive before the history they report
		// has been committed, so canGoBack still answers for the page before
		Ext.defer(function() {
			var main = Ext.cq1('app-main');
			if ( main && main.getActiveTab() === me ) main.getController().syncTitleBar();
		}, 50);
	}

	// The page itself, where the service menu's reload goes back to the start
	,reloadPage: function() {
		var webview = this.getWebView();
		if ( webview ) webview.reload();
	}

	,goBack: function() {
		var me = this;
		var webview = me.getWebView();

		if ( me.record.get('enabled') ) webview.goBack();
	}

	,goForward: function() {
		var me = this;
		var webview = me.getWebView();

		if ( me.record.get('enabled') ) webview.goForward();
	}

	,zoomIn: function() {
		this.setZoom(this.record.get('zoomLevel') + 0.25);
	}

	,zoomOut: function() {
		this.setZoom(this.record.get('zoomLevel') - 0.25);
	}

	,resetZoom: function() {
		this.setZoom(0);
	}

	// The record is the one place the level lives: the panel used to keep its
	// own copy, which started at 0 on every launch, so the first zoom after a
	// restart threw away the level the service was saved with.
	,setZoom: function(level) {
		var me = this;
		if ( !me.record.get('enabled') ) return;

		me.getWebView().setZoomLevel(level);
		me.record.set('zoomLevel', level);
		me.syncZoomLabel(me.tab.menu);
	}

	// Chromium scales by 1.2 for each zoom level.
	,syncZoomLabel: function(menu) {
		var label = menu && menu.down('#zoomReset');
		if ( label ) label.setText(Math.round(100 * Math.pow(1.2, this.record.get('zoomLevel'))) + '%');
	}

	,getWebView: function() {
		if ( this.record.get('enabled') ) {
			return this.down('component[cls=webview]').el.dom;
		} else {
			return false;
		}
	}
});
