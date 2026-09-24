Ext.define('Shep.view.main.Main', {
	 extend: 'Ext.tab.Panel'
	,requires: [
		 'Shep.view.main.MainController'
		,'Shep.view.main.MainModel'
		,'Shep.ux.WebView'
		,'Shep.ux.mixin.Badge'
		,'Shep.view.add.Add'
		,'Shep.util.Workspaces'
		,'Ext.ux.TabReorderer'
	]

	,xtype: 'app-main'

	,controller: 'main'
	,viewModel: {
		type: 'main'
	}

	,plugins: [
		{
			 ptype: 'tabreorderer'
		}
	]

	,autoRender: true
	,autoShow: true
	,deferredRender: false
	/*
	 * The window's title bar: electron/main.js hides the system's and lays the
	 * window buttons over one end of this. It spans the whole width, rail
	 * included, in the rail's colour, so the two read as one frame. It says which
	 * service is open and what page it is on, and carries what acts on that page;
	 * MainController.syncTitleBar keeps it current.
	 */
	,dockedItems: [{
		 xtype: 'toolbar'
		,dock: 'top'
		,itemId: 'titleBar'
		,height: 32
		,cls: 'rx-titlebar'
		,defaults: { xtype: 'button', scale: 'small', cls: 'rx-titlebar-btn', hidden: true }
		,items: [
			 { itemId: 'back', glyph: 'xf053@FontAwesome', tooltip: 'Back', handler: 'titleBarAction', action: 'goBack' }
			,{ itemId: 'forward', glyph: 'xf054@FontAwesome', tooltip: 'Forward', handler: 'titleBarAction', action: 'goForward' }
			,{ itemId: 'reload', glyph: 'xf021@FontAwesome', tooltip: 'Reload page', handler: 'titleBarAction', action: 'reloadPage' }
			,{ xtype: 'tbfill', hidden: false }
			// centred on the window by the stylesheet, whatever sits either side
			,{ xtype: 'component', itemId: 'identity', cls: 'rx-titlebar-identity', hidden: false, html: '<b>Shep</b>' }
			,{ xtype: 'tbfill', hidden: false }
			,{ itemId: 'find', glyph: 'xf002@FontAwesome', tooltip: 'Find in page', handler: 'titleBarAction', action: 'showSearchBox' }
		]
	}]
	,border: false
	,bodyBorder: false
	,tabBar: {
		 id: 'mainTabBar'
		,listeners: {
			afterrender: function(tabBar) { Shep.util.Workspaces.mountSwitcher(tabBar); }
		}
		,cls: JSON.parse(localStorage.getItem('dontDisturb')) ? 'dontdisturb' : ''
		/*
		 * These three used to be the home tab's own toolbar, which meant they
		 * vanished the moment a service was open. In the rail they are always
		 * there, pinned below the tabs by the fill.
		 */
		,items: [
			// A tab bar is a Header, not a Toolbar: the '->' shorthand resolves to
			// null there, and each item needs its xtype spelled out. None of them
			// is reorderable: they share the bar with the tabs, and the reorderer
			// counts every item in it, so without this a service dropped at the
			// foot of the rail swaps places with a button.
			{
				 xtype: 'button'
				,reorderable: false
				,glyph: 'xf067@FontAwesome'
				,tooltip: locale['app.main[0]']
				,handler: 'openAddService'
				,itemId: 'addService'
			}
			,{ xtype: 'tbfill', reorderable: false }
			,{
				 xtype: 'button'
				,reorderable: false
				,glyph: JSON.parse(localStorage.getItem('dontDisturb')) ? 'xf1f7@FontAwesome' : 'xf0f3@FontAwesome'
				,tooltip: locale['app.main[17]']+'<br/><b>'+locale['app.main[18]']+(shep.platform === 'darwin' ? ': Cmd + Alt + D</b>' : ': Alt + Shift + D</b>')
				,enableToggle: true
				,handler: 'dontDisturb'
				,reference: 'disturbBtn'
				,id: 'disturbBtn'
				,pressed: JSON.parse(localStorage.getItem('dontDisturb'))
			}
			,{
				 xtype: 'button'
				,reorderable: false
				,glyph: 'xf023@FontAwesome'
				,tooltip: locale['app.main[20]']+'<br/><b>'+locale['app.main[18]']+(shep.platform === 'darwin' ? ': Cmd + Alt + L</b>' : ': Alt + Shift + L</b>')
				,handler: 'lockShep'
				,id: 'lockShepBtn'
			}
			,{
				 xtype: 'button'
				,reorderable: false
				,tooltip: locale['preferences[0]']
				,glyph: 'xf013@FontAwesome'
				,handler: 'openPreferences'
			}
		]
	}
	,items: [
		{
			 id: 'shepTab'
			,border: false
			,bodyBorder: false
			,closable: false
			,reorderable: false
			,autoScroll: true
			,layout: { type: 'vbox', align: 'center', pack: 'center' }
			/*
			 * Hidden, not absent: the card is still a tab, so the shortcuts and
			 * setActiveTab keep working.
			 * It is what the app opens on, and all it has to say is where to go; the
			 * + in the rail is right beside it, so it needs no button of its own.
			 */
			,tabConfig: { hidden: true }
			,items: [
				{
					 xtype: 'component'
					,itemId: 'welcome'
					,cls: 'rx-welcome'
					,html: [
						 '<img src="resources/logo/Logo.svg" alt="">'
						,'<h1>' + locale['app.welcome[0]'] + '</h1>'
						,'<p>' + locale['app.welcome[1]'] + '</p>'
					].join('')
				}
			]
		}
		/*
		 * Splits the services aligned left from those aligned right. In a vertical
		 * rail that only needs to be a gap: left flexing, it shared the slack with
		 * the rail's own fill and pushed the + button into the middle of the bar.
		 */
		,{ id: 'tbfill', tabConfig : { xtype : 'tbfill', flex: 0, height: 14 } }
	]

	,listeners: {
		 tabchange: 'onTabChange'
		,add: 'updatePositions'
		,remove: 'updatePositions'
		,childmove: 'updatePositions'
		,boxready: 'initialize'
	}
});
