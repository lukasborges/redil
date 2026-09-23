/**
 * Default config for all webviews created
 */

Ext.define('Redil.ux.WebView',{
	 extend: 'Ext.panel.Panel'
	,xtype: 'webview'

	,requires: [
		 'Redil.util.Format'
		,'Redil.util.Notifier'
		,'Redil.util.UnreadCounter'
		,'Redil.util.IconLoader'
	]

	// private
	,zoomLevel: 0
	,currentUnreadCount: 0

	// CONFIG
	,hideMode: 'offsets'
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
			,icon: me.record.get('type') === 'custom' ? (me.record.get('logo') === '' ? 'resources/icons/custom.png' : me.record.get('logo')) : 'resources/icons/'+me.record.get('logo')
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
				,style: !me.record.get('enabled') ? '-webkit-filter: grayscale(1)' : ''
				,menu:  {
					 plain: true
					,listeners: {
						 beforeshow: me.syncServiceMenu
						,scope: me
					}
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
						,'-'
						,{
							 text: 'Zoom In'
							,needsPage: true
							,glyph: 'xf00e@FontAwesome'
							,scope: me
							,handler: me.zoomIn
						}
						,{
							 text: 'Zoom Out'
							,needsPage: true
							,glyph: 'xf010@FontAwesome'
							,scope: me
							,handler: me.zoomOut
						}
						,{
							 text: 'Reset Zoom'
							,needsPage: true
							,glyph: 'xf002@FontAwesome'
							,scope: me
							,handler: me.resetZoom
						}
						,'-'
						,{
							 text: locale['app.webview[0]']
							,needsPage: true
							,glyph: 'xf021@FontAwesome'
							,scope: me
							,handler: me.reloadService
						}
						,'-'
						,{
							 text: locale['app.webview[3]']
							,needsPage: true
							,glyph: 'xf121@FontAwesome'
							,scope: me
							,handler: me.toggleDevTools
						}
						/*
						 * What the list on the home tab used to offer, per row. The
						 * icon is the service, so it is the thing to ask.
						 */
						,'-'
						,{
							 text: locale['app.window[1]']
							,glyph: 'xf013@FontAwesome'
							,scope: me
							,handler: me.editService
						}
						,{
							 text: locale['app.service[0]']
							,itemId: 'disableService'
							,glyph: 'xf204@FontAwesome'
							,scope: me
							,handler: me.toggleService
						}
						,{
							 text: locale['app.service[1]']
							,itemId: 'enableService'
							,glyph: 'xf205@FontAwesome'
							,scope: me
							,handler: me.toggleService
						}
						,{
							 text: locale['app.main[14]']
							,glyph: 'xf1f8@FontAwesome'
							,scope: me
							,handler: me.removeService
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

		if ( me.record.get('statusbar') ) {
			Ext.apply(me, {
				bbar: me.statusBarConstructor(false)
			});
		} else {
			me.items.push(me.statusBarConstructor(true));
		}

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
					,useragent: me.getUserAgent()
					,preload: new URL('resources/js/rambox-service-api.js', window.location.href).href
				}
			}];
		}

		return cfg;
	}
	,getUserAgent: function() {
		// A user agent typed into Preferences is used exactly as written.
		var configured = ipc.sendSync('getConfig').user_agent;
		if ( configured ) return configured;

		var catalogEntry = Ext.getStore('ServicesList').getById(this.record.get('type'));
		var pinned = catalogEntry ? catalogEntry.get('userAgent') : '';

		if ( !pinned ) {
			return window.clientInformation.userAgent.replace(/Redil\/([0-9]\.?)+\s/ig,'').replace(/Electron\/([0-9]\.?)+\s/ig,'');
		}

		// The agents pinned in resources/services.json name whatever Chrome was
		// current when the entry was written. WhatsApp's still says 70, from 2018,
		// and the site now turns away anything below 100. The platform half of each
		// string is still doing a job, so only the version is moved up to the
		// Chromium this build actually runs on.
		return pinned.replace(/Chrome\/[0-9.]+/i, 'Chrome/' + redil.versions.chrome);
	}

	,statusBarConstructor: function(floating) {
		var me = this;

		return {
			 xtype: 'statusbar'
			,id: me.id+'statusbar'
			,hidden: !me.record.get('statusbar')
			,keep: me.record.get('statusbar')
			// the floating one hangs over the bottom of the page by its own height
			,y: floating ? '-22px' : 'auto'
			,height: 22
			,dock: 'bottom'
			,defaultText: '<i class="fa fa-check fa-fw" aria-hidden="true"></i> Ready'
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
					,hidden: floating
					,handler: me.closeStatusBar
					,tooltip: {
						 text: 'Close statusbar until next time'
						,mouseOffset: [0,-60]
					}
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

			if ( !me.down('statusbar').closed || !me.down('statusbar').keep ) me.down('statusbar').show();
			me.down('statusbar').showBusy();
		});

		webview.addEventListener("did-stop-loading", function() {
			me.down('statusbar').clearStatus({useDefaults: true});
			if ( !me.down('statusbar').keep ) me.down('statusbar').hide();
		});

		webview.addEventListener("did-finish-load", function(e) {
			Redil.app.setTotalServicesLoaded( Redil.app.getTotalServicesLoaded() + 1 );

			// Apply saved zoom level
			webview.setZoomLevel(me.record.get('zoomLevel'));

			// Fix cursor sometimes dissapear
			let currentTab = Ext.cq1('app-main').getActiveTab();
			if ( currentTab.id === me.id ) {
				webview.blur();
				webview.focus();
			}
			// Set special icon for some service (like Slack)
			Redil.util.IconLoader.loadServiceIconUrl(me, webview);
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

		let firstDomReady = true;
		webview.addEventListener("dom-ready", function(e) {
			// Mute Webview
			if ( me.record.get('muted') || localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb')) ) me.setAudioMuted(true, true);

			var js_inject = '';
			// Injected code to detect new messages
			if ( me.record ) {
				var js_unread = Ext.getStore('ServicesList').getById(me.record.get('type')) ? Ext.getStore('ServicesList').getById(me.record.get('type')).get('js_unread') : '' ;
				js_unread = js_unread + me.record.get('js_unread');
				if ( js_unread !== '' ) {
					console.groupCollapsed(me.record.get('type').toUpperCase() + ' - JS Injected to Detect New Messages');
					console.info(me.type);
					console.log(js_unread);
					js_inject += js_unread;
				}
			}

			// Prevent Title blinking (some services have) and only allow when the title have an unread regex match: "(3) Title"
			if ( Ext.getStore('ServicesList').getById(me.record.get('type')) ? Ext.getStore('ServicesList').getById(me.record.get('type')).get('titleBlink') : false ) {
				var js_preventBlink = 'var originalTitle=document.title;Object.defineProperty(document,"title",{configurable:!0,set:function(a){null===a.match(new RegExp("[(]([0-9•]+)[)][ ](.*)","g"))&&a!==originalTitle||(document.getElementsByTagName("title")[0].innerHTML=a)},get:function(){return document.getElementsByTagName("title")[0].innerHTML}});';
				console.log(js_preventBlink);
				js_inject += js_preventBlink;
			}

			console.groupEnd();

			// Wraps Notification so clicking one brings the window forward and
			// activates this tab. The preload used to patch the global directly;
			// it now runs in an isolated world, so this has to be injected, which
			// puts it in the page's own world alongside the js_unread snippets.
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

					me.down('statusbar').keep = true;
					me.down('statusbar').show();
					me.down('statusbar').setStatus({
						text: '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Certification Warning',
					});
					me.down('statusbar').down('button').show();
				};
				ipc.on('webview:certificate-error', me.certificateWarning);
				me.on('destroy', function() { ipc.removeListener('webview:certificate-error', me.certificateWarning); });
			}
			if (firstDomReady) {
				firstDomReady = false;

				Redil.app.config.googleURLs.forEach((loginURL) => {	if ( webview.getURL().indexOf(loginURL) > -1 ) webview.reload() })
			}
			// The error is kept, not only logged: a snippet that throws is the first
			// thing the unread report has to be able to say.
			me.injectionError = null;
			webview.executeJavaScript(js_inject)
				.then(() => {})
				.catch(err => { me.injectionError = String(err && err.message ? err.message : err); console.log(err); })
		});

		webview.addEventListener('ipc-message', function(event) {
			var channel = event.channel;
			switch (channel) {
				case 'rambox.setUnreadCount':
					handleSetUnreadCount(event);
					break;
				case 'rambox.clearUnreadCount':
					handleClearUnreadCount(event);
					break;
				case 'rambox.showWindowAndActivateTab':
					showWindowAndActivateTab(event);
					break;
			}
			/**
			 * Handles 'rambox.clearUnreadCount' messages.
			 * Clears the unread count.
			 */
			function handleClearUnreadCount() {
				me.tab.setBadgeText('');
				me.currentUnreadCount = 0;
				me.reportSnippetUnread(0);
			}

			/**
			 * Handles 'rambox.setUnreadCount' messages.
			 * Sets the badge text if the event contains an integer or a '•' (indicating non-zero but unknown number of unreads) as first argument.
			 *
			 * @param event
			 */
			function handleSetUnreadCount(event) {
				if (Array.isArray(event.args) === true && event.args.length > 0) {
					var count = event.args[0];
					if (count === parseInt(count, 10) || "•" === count) {
						if ( count === 999999 ) count = "•";
						me.reportSnippetUnread(count);
					}
				}
			}

			function showWindowAndActivateTab(event) {
				ipc.send('window:show');
				var tabPanel = Ext.cq1('app-main');
				// Temp fix missing cursor after upgrade to electron 3.x +
				tabPanel.setActiveTab(me);
				tabPanel.getActiveTab().getWebView().blur();
				tabPanel.getActiveTab().getWebView().focus();
			}
		});

		/*
		 * The title is read for every service, not only for the ones without a
		 * snippet. A snippet is written against a site that keeps changing, and
		 * when it stops matching it reports zero for ever -- the service goes
		 * quiet and nothing says why. reportTitleUnread decides which of the two
		 * answers to believe; see effectiveUnreadCount.
		 */
		webview.addEventListener("page-title-updated", function(e) {
			var count = e.title.match(/\(([^)]+)\)/); // Get text between (...)
			count = count ? count[1] : '0';
			count = count === '•' ? count : Ext.isArray(count.match(/\d+/g)) ? count.match(/\d+/g).join("") : count.match(/\d+/g); // Some services have special characters. Example: (•)
			count = count === null ? '0' : count;

			me.reportTitleUnread(count);
		});

		webview.addEventListener('did-navigate', function( e ) {
			if ( e.isMainFrame && me.record.get('type') === 'tweetdeck' ) Ext.defer(function() { webview.loadURL(e.newURL); }, 1000); // Applied a defer because sometimes is not redirecting. TweetDeck 2FA is an example.
		});

		webview.addEventListener('update-target-url', function( url ) {
			me.down('statusbar #url').setText(url.url);
		});
	}

	/**
	 * Everything the app knows about how this service is being counted, for the
	 * report under View. Testing unread detection means logging into the service,
	 * so the least this can do is say what it sees rather than leave the person
	 * guessing why a tab is quiet.
	 */
	,unreadDiagnosis: function() {
		var me = this;
		var entry = Ext.getStore('ServicesList').getById(me.record.get('type'));
		var fromCatalogue = entry ? entry.get('js_unread') !== '' : false;
		var fromService = !Ext.isEmpty(me.record.get('js_unread'));

		return {
			 name: me.record.get('name')
			,snippet: fromCatalogue || fromService ? (fromService ? 'own code' : 'catalogue') : 'none'
			,snippetUnread: me.snippetUnread === undefined || me.snippetUnread === null ? '—' : String(me.snippetUnread)
			,snippetWorks: !!me.snippetWorks
			,titleUnread: me.titleUnread === undefined || me.titleUnread === null ? '—' : String(me.titleUnread)
			,counting: me.snippetWorks ? 'snippet' : (me.countOf(me.titleUnread) > me.countOf(me.snippetUnread) ? 'title' : 'neither yet')
			,countingCls: me.snippetWorks ? 'snippet' : (me.countOf(me.titleUnread) > me.countOf(me.snippetUnread) ? 'title' : 'quiet')
			,total: String(me.countOf(me.effectiveUnreadCount()))
			,error: me.injectionError || ''
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
	 * What the service's own snippet says. Once it has ever reported more than
	 * none, it is the only answer used: it is the one that knows which chats are
	 * muted or archived, and the title does not.
	 */
	,reportSnippetUnread: function(count) {
		var me = this;

		me.snippetUnread = count;
		if ( me.countOf(count) > 0 ) me.snippetWorks = true;
		me.setUnreadCount(me.effectiveUnreadCount());
	}

	/**
	 * What the page title says, which is the safety net. A snippet that has
	 * stopped matching the site reports zero rather than failing, so a service
	 * whose title says "(3)" while its snippet says nothing is counted from the
	 * title -- possibly counting muted chats too, which beats counting nothing.
	 */
	,reportTitleUnread: function(count) {
		var me = this;

		me.titleUnread = count;
		me.setUnreadCount(me.effectiveUnreadCount());
	}

	,effectiveUnreadCount: function() {
		var me = this;

		if ( me.snippetWorks ) return me.snippetUnread;
		var chosen = me.countOf(me.titleUnread) > me.countOf(me.snippetUnread) ? me.titleUnread : me.snippetUnread;
		return chosen === undefined || chosen === null ? 0 : chosen;
	}

	,setUnreadCount: function(newUnreadCount) {
		var me = this;

		if ( !isNaN(newUnreadCount) && (function(x) { return (x | 0) === x; })(parseFloat(newUnreadCount)) && me.record.get('includeInGlobalUnreadCounter') === true) {
			Redil.util.UnreadCounter.setUnreadCountForService(me.record.get('id'), newUnreadCount);
		} else {
			Redil.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
		}

		// '•' is a service saying there is something without saying how much. It
		// is not a number, so it stays out of the total and is remembered apart.
		Redil.util.UnreadCounter.setSomethingUnreadForService(me.record.get('id'), newUnreadCount === '•');

		me.setTabBadgeText(Redil.util.Format.formatNumber(newUnreadCount));

		me.doManualNotification(parseInt(newUnreadCount));
	}

	,refreshUnreadCount: function() {
		this.setUnreadCount(this.currentUnreadCount);
	}

	/**
	 * Dispatch manual notification if
	 * • service doesn't have notifications, so Redil does them
	 * • count increased
	 * • not in dnd mode
	 * • notifications enabled
	 *
	 * @param {int} count
	 */
	,doManualNotification: function(count) {
		var me = this;
		var manualNotifications = Ext.getStore('ServicesList').getById(me.type) ? Ext.getStore('ServicesList').getById(me.type).get('manual_notifications') : false;
		if ( manualNotifications && me.currentUnreadCount < count && me.record.get('notifications') && !JSON.parse(localStorage.getItem('dontDisturb'))) {
			Redil.util.Notifier.dispatchNotification(me, count);
		}

		me.currentUnreadCount = count;
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
		Redil.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
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
		setTimeout(() => Ext.getCmp(me.id+'statusbar').setStatus({ text: '<i class="fa fa-warning fa-fw" aria-hidden="true"></i> The service failed at loading, Error: '+ v }), 1000);
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

		if ( me.record.get('enabled') ) webview.setAudioMuted(muted);
	}

	,closeStatusBar: function() {
		var me = this;

		me.down('statusbar').hide();
		me.down('statusbar').closed = true;
		me.down('statusbar').keep = me.record.get('statusbar');
	}

	,setStatusBar: function(keep) {
		var me = this;

		me.removeDocked(me.down('statusbar'), true);

		if ( keep ) {
			me.addDocked(me.statusBarConstructor(false));
		} else {
			me.add(me.statusBarConstructor(true));
		}
		me.down('statusbar').keep = keep;
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
	 * asked. The record decides when it says anything; when it says null, which
	 * is what a service configured before the setting existed says, the catalogue
	 * entry it was created from answers for it.
	 */
	,mediaAccess: function() {
		var decided = this.record.get('media');
		if ( decided === true || decided === false ) return decided;

		var entry = Ext.getStore('ServicesList').getById(this.record.get('type'));
		return !!(entry && entry.get('media'));
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

		// the separators go with the page's items, or a disabled service's menu
		// would open on a rule
		Ext.each(menu.items.items, function(item) {
			if ( item.needsPage || item.isXType('menuseparator') ) item.setHidden(!ligado);
		});
		menu.down('#disableService').setHidden(!ligado);
		menu.down('#enableService').setHidden(ligado);
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
		if ( this.timeout ) clearTimeout( this.timeout );
			this.timeout = setTimeout(() => {
				var me = this;
				var webview = me.getWebView();
				me.zoomLevel = me.zoomLevel + 0.25;
				if ( me.record.get('enabled') ) {
					webview.setZoomLevel(me.zoomLevel);
					me.record.set('zoomLevel', me.zoomLevel);
				}
		}, 100);
	}

	,zoomOut: function() {
		if ( this.timeout ) clearTimeout( this.timeout );
			this.timeout = setTimeout(() => {
				var me = this;
				var webview = me.getWebView();
				me.zoomLevel = me.zoomLevel - 0.25;
				if ( me.record.get('enabled') ) {
					webview.setZoomLevel(me.zoomLevel);
					me.record.set('zoomLevel', me.zoomLevel);
				}
		}, 100);
	}

	,resetZoom: function() {
		var me = this;
		var webview = me.getWebView();

		me.zoomLevel = 0;
		if ( me.record.get('enabled') ) {
			webview.setZoomLevel(0);
			me.record.set('zoomLevel', me.zoomLevel);
		}
	}

	,getWebView: function() {
		if ( this.record.get('enabled') ) {
			return this.down('component[cls=webview]').el.dom;
		} else {
			return false;
		}
	}
});
