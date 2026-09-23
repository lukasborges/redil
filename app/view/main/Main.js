Ext.define('Redil.view.main.Main', {
	 extend: 'Ext.tab.Panel'
	,requires: [
		 'Redil.view.main.MainController'
		,'Redil.view.main.MainModel'
		,'Redil.ux.WebView'
		,'Redil.ux.mixin.Badge'
		,'Redil.view.add.Add'
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
			,{ xtype: 'component', itemId: 'identity', cls: 'rx-titlebar-identity', hidden: false, html: '<b>Redil</b>' }
			,{ xtype: 'tbfill', hidden: false }
			,{ itemId: 'find', glyph: 'xf002@FontAwesome', tooltip: 'Find in page', handler: 'titleBarAction', action: 'showSearchBox' }
		]
	}]
	,border: false
	,bodyBorder: false
	,tabBar: {
		 id: 'mainTabBar'
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
				,handler: 'openCatalogue'
				,itemId: 'addService'
			}
			,{ xtype: 'tbfill', reorderable: false }
			,{
				 xtype: 'button'
				,reorderable: false
				,glyph: JSON.parse(localStorage.getItem('dontDisturb')) ? 'xf1f7@FontAwesome' : 'xf0f3@FontAwesome'
				,tooltip: locale['app.main[17]']+'<br/><b>'+locale['app.main[18]']+(redil.platform === 'darwin' ? ': Cmd + Alt + D</b>' : ': Alt + Shift + D</b>')
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
				,tooltip: locale['app.main[20]']+'<br/><b>'+locale['app.main[18]']+(redil.platform === 'darwin' ? ': Cmd + Alt + L</b>' : ': Alt + Shift + L</b>')
				,handler: 'lockRedil'
				,id: 'lockRedilBtn'
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
			 id: 'redilTab'
			,border: false
			,bodyBorder: false
			,closable: false
			,reorderable: false
			,autoScroll: true
			,layout: { type: 'vbox', align: 'center', pack: 'center' }
			/*
			 * Hidden, not absent: the card is still a tab, so the shortcuts and
			 * setActiveTab keep working, and the catalogue below floats inside it.
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
				,{
					/*
					 * The catalogue used to take two thirds of the home tab, which
					 * made a list of 104 services the app's front door. It is an
					 * overlay now, opened by the + in the rail. Floating keeps it
					 * out of the vbox while leaving it a child of this view, so the
					 * string handlers below still resolve against MainController.
					 */
					 xtype: 'panel'
					,title: locale['app.main[0]']
					,itemId: 'catalogue'
					,cls: 'rx-catalogue'
					,listeners: {
						hide: 'onCatalogueHide'
					}
					,floating: true
					,hidden: true
					,modal: true
					,closable: true
					// A panel closes by destroying itself, so the first click on the
					// cross took the catalogue out of the component tree and every
					// later + found nothing to show.
					,closeAction: 'hide'
					,width: 900
					,height: 660
					,layout: 'fit'
					,dockedItems: [
						{
							 xtype: 'container'
							,dock: 'top'
							,cls: 'rx-catalogue-head'
							// Without a layout the field keeps its own width and the
							// search ends up a 170px box in a 900px window.
							,layout: { type: 'vbox', align: 'stretch' }
							,items: [
								{
									 xtype: 'textfield'
									,itemId: 'catalogueSearch'
									// The title above already says what the window is for.
									,emptyText: 'Search services'
									,triggers: {
										 clear: {
											 weight: 0
											,cls: Ext.baseCSSPrefix + 'form-clear-trigger'
											,hidden: true
											,handler: 'onClearClick'
										}
										,search: {
											 weight: 1
											,cls: Ext.baseCSSPrefix + 'form-search-trigger search-trigger'
										}
									}
									,listeners: {
										 change: 'onSearchServiceChange'
										,afterrender: 'onSearchRender'
										,specialkey: 'onSearchEnter'
									}
								}
								,{
									 xtype: 'container'
									,layout: { type: 'hbox', align: 'middle' }
									,cls: 'rx-catalogue-filters'
									,items: [
										{
											/*
											 * Two always-checked boxes are not a filter, they
											 * are noise. Three states say the same thing and
											 * read as one control. doTypeFilter takes this
											 * now instead of the checkbox group.
											 */
											 xtype: 'segmentedbutton'
											,itemId: 'catalogueFilter'
											,value: 'all'
											,items: [
												 { text: 'All', value: 'all' }
												,{ text: locale['app.main[1]'], value: 'messaging' }
												,{ text: locale['app.main[2]'], value: 'email' }
											]
											,listeners: { toggle: 'doTypeFilter' }
										}
										,{ xtype: 'component', flex: 1 }
										,{ xtype: 'component', itemId: 'catalogueCount', cls: 'rx-catalogue-count' }
									]
								}
							]
						}
					]
					,items: [
						{
							 xtype: 'dataview'
							,itemId: 'catalogueList'
							,cls: 'rx-catalogue-list'
							,store: 'ServicesList'
							,itemSelector: 'div.service'
							,scrollable: 'vertical'
							,tpl: [
								 '<tpl for=".">'
									,'<div class="service" data-qtip="{description}">'
										,'<img src="resources/icons/{logo}" alt="">'
										,'<span>{name}</span>'
									,'</div>'
								,'</tpl>'
							]
							,emptyText: '<p class="rx-empty">' + locale['app.main[3]'] + '</p>'
							,listeners: {
								itemclick: 'onNewServiceSelect'
							}
						}
					]
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
