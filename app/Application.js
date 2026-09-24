Ext.define('Shep.Application', {
	 extend: 'Ext.app.Application'

	,name: 'Shep'

	,requires: [
		'Shep.util.MD5'
		,'Ext.window.Toast'
	]

	,stores: [
		'Services'
	]

	,config: {
		 totalServicesLoaded: 0
		,totalNotifications: 0
	}

	,launch: function () {

		// is-online probes the network from the main process now, and Mousetrap is
		// a browser library the generator loads as a plain script.
		(async () => {
			await ipc.invoke('net:isOnline').then(res => {
				var hideNoConnection = ipc.sendSync('getConfig').hideNoConnectionDialog
				if ( !res && !hideNoConnection ) {
					Ext.get('spinner') ? Ext.get('spinner').destroy() : null;
					Ext.get('background') ? Ext.get('background').destroy() : null;
					Ext.Msg.show({
						title: 'No Internet Connection'
						,msg: 'Please, check your internet connection. If you use a Proxy, please go to Preferences to configure it. Shep will try to re-connect in 10 seconds'
						,width: 300
						,closable: false
						,buttons: Ext.Msg.YESNO
						,buttonText: {
							yes: 'Ok'
							,no: 'Never show this again'
						}
						,multiline: false
						,fn: function(buttonValue, inputText, showConfig) {
							if ( buttonValue === 'no' ) {
								ipc.send('sConfig', { hideNoConnectionDialog: true });
								hideNoConnection = true;
							}
						}
						,icon: Ext.Msg.QUESTION
					});
					setTimeout(function() {
						if ( !hideNoConnection ) ipc.send('reloadApp')
					}, 10000)
				}
			})
		})();

		var mediaAccess = shep.platform === 'darwin' ? ipc.sendSync('media:getAccessStatus') : null;
		if ( !localStorage.getItem('hideMacPermissions') && mediaAccess && (mediaAccess.microphone !== 'granted' || mediaAccess.camera !== 'granted') ) {
			console.info('Checking mac permissions...');
			Ext.cq1('app-main').addDocked({
				xtype: 'toolbar'
				,dock: 'top'
				,style: {background: '#30BBF3'}
				,items: [
					'->'
					,{
						xtype: 'label'
						,html: '<b>Shep CE needs permissions to use Microphone and Camera for the apps.</b>'
					}
					,{
						xtype: 'button'
						,text: 'Grant permissions'
						,ui: 'decline'
						,handler: async function(btn) {
							await ipc.invoke('media:askForAccess');
							Ext.cq1('app-main').removeDocked(btn.up('toolbar'), true);
						}
					}
					,{
						xtype: 'button'
						,text: 'Never ask again'
						,ui: 'decline'
						,handler: function(btn) {
							Ext.cq1('app-main').removeDocked(btn.up('toolbar'), true);
							localStorage.setItem('hideMacPermissions', true);
						}
					}
					,'->'
					,{
						glyph: 'xf00d@FontAwesome'
						,baseCls: ''
						,style: 'cursor:pointer;'
						,handler: function(btn) { Ext.cq1('app-main').removeDocked(btn.up('toolbar'), true); }
					}
				]
			});
		}

		// Load language for Ext JS library
		Ext.Loader.loadScript({url: Ext.util.Format.format("ext/packages/ext-locale/build/ext-locale-{0}.js", localStorage.getItem('locale-extjs') || 'en')});

		// Shortcuts
		const platform = shep.platform;
		// Prevents default behaviour of Mousetrap, that prevents shortcuts in textareas
		Mousetrap.prototype.stopCallback = function(e, element, combo) {
			return false;
		};
		// Add shortcuts to switch services using CTRL + Number
		Mousetrap.bind(platform === 'darwin' ? ["command+1","command+2","command+3","command+4","command+5","command+6","command+7","command+8","command+9"] : ["ctrl+1","ctrl+2","ctrl+3","ctrl+4","ctrl+5","ctrl+6","ctrl+7","ctrl+8","ctrl+9"], function(e, combo) { // GROUPS
			// counted over the services the rail is showing, which in a workspace
			// is not every service there is
			var tab = Shep.util.Workspaces.visibleServiceTabs()[parseInt(e.key, 10) - 1];
			if ( tab ) Ext.cq1('app-main').setActiveTab(tab);
		});
		// Ctrl+Alt+1..9 switches workspace, beside Ctrl+1..9 for the services in it
		Mousetrap.bind([1,2,3,4,5,6,7,8,9].map(n => (platform === 'darwin' ? 'command+alt+' : 'ctrl+alt+') + n), function(e) {
			Shep.util.Workspaces.activateByNumber(parseInt(e.key, 10));
		});
		// Add shortcut to main tab (ctrl+,)
		Mousetrap.bind(platform === 'darwin' ? 'command+,' : 'ctrl+,', (e, combo) => {
			Ext.cq1('app-main').setActiveTab(0);
		});
		// Add shortcuts to navigate through services: the ones on show, cycling
		var cycleServices = function(step) {
			var tabs = Shep.util.Workspaces.visibleServiceTabs();
			if ( !tabs.length ) return;
			var i = tabs.indexOf(Ext.cq1('app-main').getActiveTab());
			// from the home tab, forward is the first and back is the last
			i = i === -1 ? (step > 0 ? 0 : tabs.length - 1) : (i + step + tabs.length) % tabs.length;
			Ext.cq1('app-main').setActiveTab(tabs[i]);
		};
		Mousetrap.bind(['ctrl+tab', 'ctrl+pagedown'], () => cycleServices(1));
		Mousetrap.bind(['ctrl+shift+tab', 'ctrl+pageup'], () => cycleServices(-1));
		// Add shortcut to search inside a service
		Mousetrap.bind(shep.platform === 'darwin' ? ['command+alt+f'] : ['shift+alt+f'], (e, combo) => {
			var currentTab = Ext.cq1('app-main').getActiveTab();
			if ( currentTab.getWebView ) currentTab.showSearchBox(true);
		});
		// Add shortcut to Do Not Disturb
		Mousetrap.bind(platform === 'darwin' ? ["command+alt+d"] : ["shift+alt+d"], function(e, combo) {
			var btn = Ext.getCmp('disturbBtn');
			btn.toggle();
			Ext.cq1('app-main').getController().dontDisturb(btn, true);
		});
		// Add shortcut to Lock Shep
		Mousetrap.bind(platform === 'darwin' ? ['command+alt+l'] : ['shift+alt+l'], (e, combo) => {
			var btn = Ext.getCmp('lockShepBtn');
			Ext.cq1('app-main').getController().lockShep(btn);
		});

		/*
		 * The accelerators the menu bar used to carry. macOS keeps its menu and
		 * its accelerators; elsewhere there is no menu, and main.js replays a
		 * key typed inside a service into this window, so these answer there
		 * as well.
		 */
		if ( platform !== 'darwin' ) {
			const activeService = () => {
				var tab = Ext.cq1('app-main').getActiveTab();
				return tab.getWebView && tab.record.get('enabled') ? tab : null;
			};
			Mousetrap.bind('ctrl+q', () => { ipc.send('app:quit'); });
			Mousetrap.bind('ctrl+r', () => { ipc.send('reloadApp'); });
			Mousetrap.bind('ctrl+shift+r', () => { var tab = activeService(); if ( tab ) tab.reloadService(); });
			Mousetrap.bind(['ctrl+=', 'ctrl+plus'], () => { var tab = activeService(); if ( tab ) tab.zoomIn(); });
			Mousetrap.bind('ctrl+-', () => { var tab = activeService(); if ( tab ) tab.zoomOut(); });
			Mousetrap.bind('ctrl+0', () => { var tab = activeService(); if ( tab ) tab.resetZoom(); });
			Mousetrap.bind('f11', () => { ipc.send('window:toggleFullScreen'); });
			Mousetrap.bind('ctrl+shift+i', () => { ipc.send('window:toggleDevTools'); });
		}

		var ONE_ZOOM_STEP_PER_WHEEL_TURN_MS = 100;
		var lastWheelZoomAt = 0;
		document.addEventListener('mousewheel', function(e) {
			if( e.ctrlKey ) {
				if ( Date.now() - lastWheelZoomAt < ONE_ZOOM_STEP_PER_WHEEL_TURN_MS ) return;
				lastWheelZoomAt = Date.now();
				var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

				var tabPanel = Ext.cq1('app-main');
				if ( tabPanel.items.indexOf(tabPanel.getActiveTab()) === 0 ) return false;

				if ( delta === 1 ) { // Zoom In
					tabPanel.getActiveTab().zoomIn();
				} else { // Zoom Out
					tabPanel.getActiveTab().zoomOut();
				}
			}
		});

		// Define default value
		if ( localStorage.getItem('dontDisturb') === null ) localStorage.setItem('dontDisturb', false);
		ipc.send('setDontDisturb', localStorage.getItem('dontDisturb')); // We store it in config

		if ( localStorage.getItem('locked') ) {
			console.info('Lock Shep:', 'Enabled');
			Ext.cq1('app-main').getController().showLockWindow();
		}
		Ext.getStore('Services').load();

		Ext.get('spinner') ? Ext.get('spinner').destroy() : null;
		Ext.get('background') ? Ext.get('background').destroy() : null;
	}

	,updateTotalNotifications: function( newValue, oldValue ) {
		newValue = parseInt(newValue);
		if ( newValue > 0 )	{
			if ( Ext.cq1('app-main').getActiveTab().record ) {
				document.title = 'Shep (' + Shep.util.Format.formatNumber(newValue) + ') - '+Ext.cq1('app-main').getActiveTab().record.get('name');
			} else {
				document.title = 'Shep (' + Shep.util.Format.formatNumber(newValue) + ')';
			}
		} else {
			if ( Ext.cq1('app-main') && Ext.cq1('app-main').getActiveTab().record ) {
				document.title = 'Shep - '+Ext.cq1('app-main').getActiveTab().record.get('name');
			} else {
				document.title = 'Shep';
			}
		}
	}

	,checkUpdate: function(silence) {
		ipc.send('autoUpdater:check-for-updates');
	}
});
