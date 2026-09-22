Ext.define('Redil.Application', {
	 extend: 'Ext.app.Application'

	,name: 'Redil'

	,requires: [
		'Redil.util.MD5'
		,'Ext.window.Toast'
	]

	,stores: [
		 'ServicesList'
		,'Services'
	]

	,config: {
		 totalServicesLoaded: 0
		,totalNotifications: 0
		,googleURLs: []
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
						,msg: 'Please, check your internet connection. If you use a Proxy, please go to Preferences to configure it. Redil will try to re-connect in 10 seconds'
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

		var mediaAccess = redil.platform === 'darwin' ? ipc.sendSync('media:getAccessStatus') : null;
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
						,html: '<b>Redil CE needs permissions to use Microphone and Camera for the apps.</b>'
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


		Ext.getStore('ServicesList').load(function (records, operations, success) {

			if (!success) {
				Ext.cq1('app-main').addDocked({
					 xtype: 'toolbar'
					,dock: 'top'
					,ui: 'servicesnotloaded'
					,style: { background: '#efef6d' }
					,items: [
						'->'
						,{
							 xtype: 'label'
							,html: '<b>Services couldn\'t be loaded, some Redil features will not be available.</b>'
						}
						,{
							 xtype: 'button'
							,text: 'Reload'
							,handler: function() { ipc.send('reloadApp'); }
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

			// Set Google URLs
			Redil.app.config.googleURLs = [
				"accounts.google.com/ServiceLogin",
				"accounts.google.com/signin",
				"accounts.google.com/_/lookup/accountlookup",
				"accounts.google.com/o/oauth2",
				"accounts.google.com/_/signin",
				"accounts.google.com/AddSession?",
				"accounts.google.com/_/"
			];

			// Shortcuts
			const platform = redil.platform;
			// Prevents default behaviour of Mousetrap, that prevents shortcuts in textareas
			Mousetrap.prototype.stopCallback = function(e, element, combo) {
				return false;
			};
			// Add shortcuts to switch services using CTRL + Number
			Mousetrap.bind(platform === 'darwin' ? ["command+1","command+2","command+3","command+4","command+5","command+6","command+7","command+8","command+9"] : ["ctrl+1","ctrl+2","ctrl+3","ctrl+4","ctrl+5","ctrl+6","ctrl+7","ctrl+8","ctrl+9"], function(e, combo) { // GROUPS
				var tabPanel = Ext.cq1('app-main');
				var arg = parseInt(e.key);
				if ( arg >= tabPanel.items.indexOf(Ext.getCmp('tbfill')) ) arg++;
				tabPanel.setActiveTab(arg);
			});
			// Add shortcut to main tab (ctrl+,)
			Mousetrap.bind(platform === 'darwin' ? 'command+,' : 'ctrl+,', (e, combo) => {
				Ext.cq1('app-main').setActiveTab(0);
			});
			// Add shortcuts to navigate through services
			Mousetrap.bind(['ctrl+tab', 'ctrl+pagedown'], (e, combo) => {
				var tabPanel = Ext.cq1('app-main');
				var activeIndex = tabPanel.items.indexOf(tabPanel.getActiveTab());
				var i = activeIndex + 1;
				// "cycle" (go to the start) when the end is reached or the end is the spacer "tbfill"
				if (i === tabPanel.items.items.length || i === tabPanel.items.items.length - 1 && tabPanel.items.items[i].id === 'tbfill') i = 0;
				// skip spacer
				while (tabPanel.items.items[i].id === 'tbfill') i++;
				tabPanel.setActiveTab(i);
			});
			Mousetrap.bind(['ctrl+shift+tab', 'ctrl+pageup'], (e, combo) => {
				var tabPanel = Ext.cq1('app-main');
				var activeIndex = tabPanel.items.indexOf(tabPanel.getActiveTab());
				var i = activeIndex - 1;
				if ( i < 0 ) i = tabPanel.items.items.length - 1;
				while ( tabPanel.items.items[i].id === 'tbfill' || i < 0 ) i--;
				tabPanel.setActiveTab(i);
			});
			// Add shortcut to search inside a service
			Mousetrap.bind(redil.platform === 'darwin' ? ['command+alt+f'] : ['shift+alt+f'], (e, combo) => {
				var currentTab = Ext.cq1('app-main').getActiveTab();
				if ( currentTab.getWebView ) currentTab.showSearchBox(true);
			});
			// Add shortcut to Do Not Disturb
			Mousetrap.bind(platform === 'darwin' ? ["command+alt+d"] : ["shift+alt+d"], function(e, combo) {
				var btn = Ext.getCmp('disturbBtn');
				btn.toggle();
				Ext.cq1('app-main').getController().dontDisturb(btn, true);
			});
			// Add shortcut to Lock Redil
			Mousetrap.bind(platform === 'darwin' ? ['command+alt+l'] : ['shift+alt+l'], (e, combo) => {
				var btn = Ext.getCmp('lockRedilBtn');
				Ext.cq1('app-main').getController().lockRedil(btn);
			});

			// Mouse Wheel zooming
			document.addEventListener('mousewheel', function(e) {
				if( e.ctrlKey ) {
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
				console.info('Lock Redil:', 'Enabled');
				Ext.cq1('app-main').getController().showLockWindow();
			}
			Ext.getStore('Services').load();
		});
	}

	,updateTotalNotifications: function( newValue, oldValue ) {
		newValue = parseInt(newValue);
		if ( newValue > 0 )	{
			if ( Ext.cq1('app-main').getActiveTab().record ) {
				document.title = 'Redil (' + Redil.util.Format.formatNumber(newValue) + ') - '+Ext.cq1('app-main').getActiveTab().record.get('name');
			} else {
				document.title = 'Redil (' + Redil.util.Format.formatNumber(newValue) + ')';
			}
		} else {
			if ( Ext.cq1('app-main') && Ext.cq1('app-main').getActiveTab().record ) {
				document.title = 'Redil - '+Ext.cq1('app-main').getActiveTab().record.get('name');
			} else {
				document.title = 'Redil';
			}
		}
	}

	,checkUpdate: function(silence) {
		ipc.send('autoUpdater:check-for-updates');
	}
});
