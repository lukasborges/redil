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
			// null there, and each item needs its xtype spelled out.
			{
				 xtype: 'button'
				,glyph: 'xf067@FontAwesome'
				,tooltip: locale['app.main[0]']
				,handler: 'openCatalogue'
				,itemId: 'addService'
			}
			,{ xtype: 'tbfill' }
			,{
				 xtype: 'button'
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
				,glyph: 'xf023@FontAwesome'
				,tooltip: locale['app.main[20]']+'<br/><b>'+locale['app.main[18]']+(redil.platform === 'darwin' ? ': Cmd + Alt + L</b>' : ': Alt + Shift + L</b>')
				,handler: 'lockRedil'
				,id: 'lockRedilBtn'
			}
			,{
				 xtype: 'button'
				,tooltip: locale['preferences[0]']
				,glyph: 'xf013@FontAwesome'
				,handler: 'openPreferences'
			}
		]
	}
	,items: [
		{
			 icon: 'resources/IconTray@2x.png'
			,id: 'redilTab'
			,closable: false
			,reorderable: false
			,autoScroll: true
			,layout: 'hbox'
			,tabConfig: {} // Created empty for Keyboard Shortcuts
			/*
			 * The one thing only this app can tell you, said in words at the top
			 * of its own tab. Application.updateTotalNotifications writes it: the
			 * Ext config of the same name already fires on every change.
			 */
			,dockedItems: [
				{
					 xtype: 'component'
					,dock: 'top'
					,itemId: 'unreadSummary'
					,cls: 'rx-summary'
					,html: '<h1>No unread messages</h1><p>Nothing is waiting in your services.</p>'
				}
			]
			,items: [
				{
					/*
					 * The catalogue used to take two thirds of the home tab, which
					 * made a list of 104 services the app's front door. It is an
					 * overlay now, opened by the + in the rail. Floating keeps it
					 * out of the hbox while leaving it a child of this view, so the
					 * string handlers below still resolve against MainController.
					 */
					 xtype: 'panel'
					,title: locale['app.main[0]']
					,itemId: 'catalogue'
					,cls: 'rx-catalogue'
					,floating: true
					,hidden: true
					,modal: true
					,closable: true
					,width: 900
					,height: 660
					,layout: 'fit'
					,dockedItems: [
						{
							 xtype: 'container'
							,dock: 'top'
							,cls: 'rx-catalogue-head'
							,items: [
								{
									 xtype: 'textfield'
									,itemId: 'catalogueSearch'
									,emptyText: locale['app.main[0]']
									,anchor: '100%'
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
				,{
					/*
					 * A dataview, not a grid. The grid drew each row as a <table>,
					 * which fought every attempt to give the rows the shape the
					 * design asks for -- margins and corners do not apply to a
					 * layout Ext sizes in pixels. Here the row's markup is ours and
					 * Ext still binds the store and dispatches the clicks.
					 *
					 * Two things the grid did are gone with it. Rows no longer group
					 * by align: the rail already shows that split, above and below
					 * its fill. And a name is renamed in the Edit window rather than
					 * in place, which is where every other field of a service lives.
					 */
					 xtype: 'panel'
					,title: locale['app.main[4]']
					,cls: 'rx-services'
					,flex: 1
					,scrollable: 'vertical'
					,bodyPadding: '0 34 14 34'
					,tools: [
						{
							 xtype: 'button'
							,glyph: 'xf1f8@FontAwesome'
							,tooltip: locale['app.main[6]']
							,handler: 'removeAllServices'
						}
					]
					,items: [
						{
							 xtype: 'dataview'
							,itemId: 'serviceList'
							,store: 'Services'
							,itemSelector: '.rx-service'
							,tpl: new Ext.XTemplate(
								'<tpl for=".">'
									, '<div class="rx-service<tpl if="!enabled"> rx-service-off</tpl>">'
										, '<img class="rx-service-icon" src="{[ this.icone(values) ]}" alt="">'
										, '<span class="rx-service-name">{name:htmlEncode}</span>'
										, '<tpl if="this.naoLidas(values.id) &gt; 0">'
											, '<em class="rx-unread">{[ this.naoLidas(values.id) ]} unread</em>'
										, '</tpl>'
										, '<i class="rx-dot rx-dot-{[ this.estado(values) ]}"></i>'
										, '<span class="rx-state">{[ this.rotulo(values) ]}</span>'
										, '<span class="rx-service-actions">'
											, '<a href="#" class="rx-act" data-act="edit" title="' + locale['app.main[13]'] + '"><i class="fa fa-cog"></i></a>'
											, '<a href="#" class="rx-act" data-act="remove" title="' + locale['app.main[14]'] + '"><i class="fa fa-trash"></i></a>'
											, '<a href="#" class="rx-act rx-act-toggle" data-act="toggle" title="{[ values.enabled ? \'Disable\' : \'Enable\' ]}">'
												, '<i class="fa fa-{[ values.enabled ? \'toggle-on\' : \'toggle-off\' ]}"></i>'
											, '</a>'
										, '</span>'
									, '</div>'
								, '</tpl>'
								, {
									 icone: function(v) {
										if ( v.type !== 'custom' ) return 'resources/icons/' + v.logo;
										return v.logo === '' ? 'resources/icons/custom.png' : v.logo;
									}
									,naoLidas: function(id) {
										return Redil.util.UnreadCounter.getUnreadCountForService(id);
									}
									,estado: function(v) {
										if ( !v.enabled ) return 'disabled';
										return v.muted || !v.notifications ? 'muted' : 'active';
									}
									,rotulo: function(v) {
										if ( !v.enabled ) return 'Disabled';
										if ( v.muted ) return 'Muted';
										return v.notifications ? 'Active' : 'Silent';
									}
								}
							)
							,listeners: {
								 itemclick: 'onServiceListClick'
								,itemdblclick: 'showServiceTab'
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
