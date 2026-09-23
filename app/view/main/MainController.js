Ext.define('Redil.view.main.MainController', {
	 extend: 'Ext.app.ViewController'

	,alias: 'controller.main'

	,initialize: function( tabPanel ) {
		// Fixed, in the shape Franz and Station settled on: a vertical rail of
		// icons. The four-sided tabbar_location preference went with it.
		tabPanel.setTabPosition('left');
		tabPanel.setTabRotation(0);

		// the card's own resize event does not reach here while the catalogue is
		// floating over it, so the viewport's is used, once layout has settled
		Ext.on('resize', this.placeCatalogue, this, { buffer: 60 });

		var reorderer = tabPanel.plugins.find(function(plugin) { return plugin.ptype == "tabreorderer"});

		if ( reorderer !== undefined ) {
			const names = reorderer.container.getLayout().names;
			reorderer.dd.dim = names.width;
			reorderer.dd.startAttr = names.beforeX;
			reorderer.dd.endAttr = names.afterX;
		}
	}

	// Make focus on webview every time the user change tabs, to enable the autofocus in websites
	,onTabChange: function( tabPanel, newTab, oldTab ) {
		var me = this;

		localStorage.setItem('last_active_service', newTab.id);

		me.syncTitleBar();

		if ( newTab.id === 'redilTab' ) {
			if ( Redil.app.getTotalNotifications() > 0 ) {
				document.title = 'Redil ('+ Redil.app.getTotalNotifications() +')';
			} else {
				document.title = 'Redil';
			}
			return;
		}

		if (!newTab.record.get('enabled') ) {
			return;
		}

		var webview = newTab.down('component').el.dom;

		setTimeout(function () {
			// Whoever is active in 300ms may not be this tab any more, and the
			// home tab has no webview to focus: opening the catalogue from a
			// service switches twice inside that window.
			if ( !webview || tabPanel.getActiveTab() !== newTab ) return;

			newTab.getWebView().blur();
			newTab.getWebView().focus();
		}, 300);

		// Update the main window so it includes the active tab title.
		if ( Redil.app.getTotalNotifications() > 0 ) {
			document.title = 'Redil ('+ Redil.app.getTotalNotifications() +') - ' + newTab.record.get('name');
		} else {
			document.title = 'Redil - ' + newTab.record.get('name');
		}
	}

	/*
	 * The title bar follows the active service: its icon and name, the page it
	 * is on, and back and forward only while there is somewhere to go. The home
	 * tab and a disabled service have no page, so they get the name alone.
	 */
	,syncTitleBar: function() {
		var bar = this.getView().down('#titleBar');
		if ( !bar ) return;

		var tab = this.getView().getActiveTab();
		var page = tab && tab.getWebView ? tab.getWebView() : false;
		var identity = bar.down('#identity');

		if ( !page ) {
			identity.update('<b>Redil</b>');
		} else {
			// a service puts its unread count in the title; the rail already says it
			var title = (tab.pageTitle || '').replace(/^\([^)]*\)\s*/, '');
			var name = tab.record.get('name');
			identity.update(
				 '<img src="' + Ext.String.htmlEncode(tab.icon) + '" alt="">'
				+'<b>' + Ext.String.htmlEncode(name) + '</b>'
				+( title && title !== name ? '<span>' + Ext.String.htmlEncode(title) + '</span>' : '' )
			);
		}

		Ext.each(['back', 'forward', 'reload', 'find'], function(id) { bar.down('#' + id).setVisible(!!page); });
		if ( page && page.canGoBack ) {
			try {
				bar.down('#back').setDisabled(!page.canGoBack());
				bar.down('#forward').setDisabled(!page.canGoForward());
			} catch (e) {
				// a webview that has not attached yet cannot answer
			}
		}
	}

	,titleBarAction: function(btn) {
		var tab = this.getView().getActiveTab();
		if ( tab && tab.getWebView && tab.getWebView() ) tab[btn.action](true);
	}

	/*
	 * The rail is the source of truth for the order, and this is the one place
	 * that walks from it back into the store. It used to finish with
	 * store.load(), which re-read localStorage: the records were removed and
	 * added again while 'remove' was suspended, so the home tab's list kept
	 * nodes for records the store no longer held and threw on the next add.
	 * Setting the fields and sorting does the same job without the round trip.
	 */
	,updatePositions: function(tabPanel, tab) {
		if ( tab.id === 'redilTab' || tab.id === 'tbfill' ) return true;

		var store = Ext.getStore('Services');
		var align = 'left';

		store.suspendEvent('remove', 'add');
		Ext.each(tabPanel.items.items, function(t, i) {
			// Everything after the fill belongs to the right group, and the fill
			// itself is one of the indexes, so the right side counts from one less.
			if ( t.id === 'tbfill' ) {
				align = 'right';
				return;
			}
			if ( t.id === 'redilTab' || !t.record ) return;

			var rec = store.getById(t.record.get('id'));
			if ( !rec ) return;

			rec.set({ align: align, position: align === 'right' ? i - 1 : i });
		});
		store.resumeEvent('remove', 'add');

		// position is the store's sort field, so the store follows the rail
		// rather than the other way round.
		store.sort();
	}

	/**
	 * Disabling keeps the service in the rail, greyed, rather than taking its
	 * tab away: with the list on the home tab gone, the icon's own right click
	 * is the only way back, so the icon has to stay.
	 */
	,toggleService: function( rec ) {
		var ligado = !rec.get('enabled');
		rec.set('enabled', ligado);
		Ext.getCmp('tab_' + rec.get('id')).setEnabled(ligado);
	}

	/*
	 * The catalogue lives in the home tab as a hidden floating panel rather than
	 * in a window of its own, so that its filters, its search and its item click
	 * keep resolving to the methods below without a second controller.
	 */
	/*
	 * The catalogue's element lives inside the home tab's card, and the card
	 * layout hides the card by hiding its element, so from a service the + did
	 * nothing at all: the panel was shown inside something display:none. Opening
	 * it brings the home tab forward, and closing it puts the service back,
	 * unless one was picked, in which case the add window decides where you end.
	 */
	,openCatalogue: function() {
		var painel = Ext.cq1('app-main');
		var catalogo = Ext.getCmp('redilTab').down('#catalogue');

		if ( painel.getActiveTab().id !== 'redilTab' ) {
			catalogo.previousTab = painel.getActiveTab().id;
			painel.setActiveTab('redilTab');
		}

		catalogo.show();
		this.placeCatalogue();
		// Nothing has filtered the store the first time the overlay opens, and
		// the tally is written by the filter, so it would sit empty.
		this.updateCatalogueCount();
		catalogo.down('#catalogueSearch').focus(false, 100);
	}

	/**
	 * The unread report. Every service counts differently and none of it can be
	 * tested without logging in, so this says, for each service open right now,
	 * what its snippet answered, what its title said and which of the two the
	 * count came from. A service reading "neither yet" with a snippet is the
	 * shape of a snippet that has stopped matching its site.
	 */
	,showUnreadReport: function() {
		var linhas = [];
		Ext.cq1('app-main').items.each(function(aba) {
			if ( !aba.unreadDiagnosis || !aba.record || !aba.record.get('enabled') ) return;
			linhas.push(aba.unreadDiagnosis());
		});

		var existente = Ext.getCmp('unreadReport');
		if ( existente ) existente.destroy();

		Ext.create('Ext.window.Window', {
			 id: 'unreadReport'
			,title: 'Unread detection'
			,cls: 'rx-prefs'
			,width: 760
			,height: 420
			,modal: true
			,closeAction: 'destroy'
			,layout: 'fit'
			,bodyPadding: 0
			,items: [
				{
					 xtype: 'dataview'
					,cls: 'rx-report'
					,scrollable: 'vertical'
					,store: Ext.create('Ext.data.Store', {
						 fields: ['name', 'snippet', 'snippetUnread', 'snippetWorks', 'titleUnread', 'counting', 'countingCls', 'total', 'error']
						,data: linhas
					})
					,itemSelector: 'div.rx-report-row'
					,tpl: [
						 '<div class="rx-report-head">'
							,'<span class="rx-report-name">Service</span>'
							,'<span>Snippet</span><span>Says</span><span>Title</span><span>Counting</span><span>Total</span>'
						,'</div>'
						,'<tpl for=".">'
							,'<div class="rx-report-row">'
								,'<span class="rx-report-name">{name}</span>'
								,'<span>{snippet}</span>'
								,'<span>{snippetUnread}</span>'
								,'<span>{titleUnread}</span>'
								,'<span class="rx-report-{countingCls}">{counting}</span>'
								,'<span>{total}</span>'
								,'<tpl if="error"><span class="rx-report-error">{error}</span></tpl>'
							,'</div>'
						,'</tpl>'
					]
					,emptyText: '<p class="rx-empty">No service is open, so there is nothing to report.</p>'
				}
			]
			,buttons: [
				{
					 text: 'Copy'
					,ui: 'decline'
					,handler: function() {
						var texto = linhas.map(function(l) {
							return [l.name, l.snippet, l.snippetUnread, l.titleUnread, l.counting, l.total, l.error].join('\t');
						}).join('\n');
						ipc.send('clipboard:writeText', texto);
					}
				}
				,{ xtype: 'tbfill' }
				,{ text: locale['button[0]'], handler: function(b) { b.up('window').close(); } }
			]
		}).show();
	}

	/*
	 * center() lost the horizontal offset inside the home card and pinned the
	 * catalogue to the rail's edge, so it is placed by hand: in the middle of
	 * the card, never larger than it with a margin all round, and again whenever
	 * the window changes size while it is open, which initialize wires up.
	 */
	,placeCatalogue: function() {
		var cartao = Ext.getCmp('redilTab');
		var catalogo = cartao.down('#catalogue');
		if ( !catalogo.isVisible() ) return;

		var area = cartao.body.getBox();
		var largura = Math.min(900, area.width - 48);
		var altura = Math.min(660, area.height - 48);

		catalogo.setSize(largura, altura);
		catalogo.setXY([
			 Math.round(area.x + (area.width - largura) / 2)
			,Math.round(area.y + (area.height - altura) / 2)
		]);
	}

	,onCatalogueHide: function( catalogo ) {
		var anterior = catalogo.previousTab;
		delete catalogo.previousTab;

		if ( anterior && Ext.getCmp(anterior) ) Ext.cq1('app-main').setActiveTab(anterior);
	}

	,onNewServiceSelect: function( view, record, item, index, e ) {
		// Picking a service ends the trip: the add window, and then the new
		// service's own tab, decide where you are, not the tab you came from.
		var catalogo = Ext.getCmp('redilTab').down('#catalogue');
		if ( catalogo ) delete catalogo.previousTab;

		Ext.create('Redil.view.add.Add', {
			record: record
		});
	}

	,removeServiceFn: function(serviceId, total, actual, callback) {
		var me = this;
		if ( !serviceId ) return false;

		// Get Record
		var rec = Ext.getStore('Services').getById(serviceId);

		if ( !rec.get('enabled') ) {
			// A disabled service has no webview, and clearing its data needs one.
			var tab = Ext.getCmp('tab_'+serviceId);
			rec.set('enabled', true);
			tab.setEnabled(true);
			// Clear all trash data
			const webview = tab.getWebView();
			webview.addEventListener("did-start-loading", function() {
				clearData(webview, tab);
			});
		} else {
			// Get Tab
			var tab = Ext.getCmp('tab_'+serviceId);
			// Clear all trash data
			const webview = tab.getWebView();
			clearData(webview, tab);
		}

		const config = ipc.sendSync('getConfig');
		if ( config.default_service === rec.get('id') ) ipc.send('setConfig', Ext.apply(config, { default_service: 'redilTab' }));

		function clearData(webview, tab) {
			ipc.invoke('webview:clearData', webview.getWebContentsId()).then(() => {
				// Remove record from localStorage
				Ext.getStore('Services').remove(rec);
				// Close tab
				tab.close();
				// Close waiting message
				if ( total === actual ) {
					Ext.Msg.hide();
					if ( Ext.isFunction(callback) ) callback();
				}
			}).catch(err => { console.log(err) })
		}
	}

	,removeService: function( gridView, rowIndex, colIndex, col, e, rec, rowEl ) {
		var me = this;

		Ext.Msg.confirm(locale['app.window[12]'], locale['app.window[13]']+' <b>'+rec.get('name')+'</b>?', function(btnId) {
			if ( btnId === 'yes' ) {
				Ext.Msg.wait('Please wait until we clear all.', 'Removing...');
				me.removeServiceFn(rec.get('id'), 1, 1);
			}
		});
	}

	,removeAllServices: function(btn, callback) {
		var me = this;

		if ( btn ) {
			Ext.Msg.confirm(locale['app.window[12]'], locale['app.window[14]'], function(btnId) {
				if ( btnId === 'yes' ) {
					// Clear counter for unread messaging
					document.title = 'Redil';

					Ext.cq1('app-main').suspendEvent('remove');
					Ext.getStore('Services').load();
					Ext.Msg.wait('Please wait until we clear all.', 'Removing...');
					const count = Ext.getStore('Services').getCount();
					var i = 1;
					Ext.Array.each(Ext.getStore('Services').collect('id'), function(serviceId) {
						me.removeServiceFn(serviceId, count, i++, callback || false);
					});
					if ( count === 0 && Ext.isFunction(callback) ) callback();
					Ext.cq1('app-main').resumeEvent('remove');
				}
			});
		} else {
			Ext.cq1('app-main').suspendEvent('remove');
			Ext.getStore('Services').load();
			const count = Ext.getStore('Services').getCount();
			var i = 1;
			Ext.Array.each(Ext.getStore('Services').collect('id'), function(serviceId) {
				me.removeServiceFn(serviceId, count, i++, callback || false);
			});
			if ( count === 0 && Ext.isFunction(callback) ) callback();
			Ext.cq1('app-main').resumeEvent('remove');
		}
	}

	,configureService: function( gridView, rowIndex, colIndex, col, e, rec, rowEl ) {
		Ext.create('Redil.view.add.Add', {
			 record: rec
			,service: Ext.getStore('ServicesList').getById(rec.get('type'))
			,edit: true
		});
	}

	,onSearchRender: function( field ) {
		field.focus(false, 1000);
	}

	,onSearchEnter: function( field, e ) {
		if ( e.getKey() !== e.ENTER ) return;

		// Enter adds the one service left standing. The custom entry is always
		// among the visible records, so it is not what "one left" counts.
		var visiveis = [];
		Ext.getStore('ServicesList').each(function(record) {
			if ( record.get('type') !== 'custom' ) visiveis.push(record);
		});
		if ( visiveis.length !== 1 ) return;

		this.onNewServiceSelect(null, visiveis[0]);
		this.onClearClick(field);
	}

	/*
	 * The type buttons and the search box are one filter, not two. Each handler
	 * writes its value and this reads both, so typing a name no longer forgets
	 * which type is selected, and picking a type no longer clears the search.
	 */
	,applyCatalogueFilter: function() {
		var catalogo = Ext.getCmp('redilTab').down('#catalogue');
		if ( !catalogo ) return;

		var tipo = catalogo.down('#catalogueFilter').getValue() || 'all';
		var termo = (catalogo.down('#catalogueSearch').getValue() || '').toLowerCase();

		Ext.getStore('ServicesList').getFilters().replaceAll({
			fn: function(record) {
				// The synthetic custom entry belongs to every view of the list.
				if ( record.get('type') === 'custom' ) return true;
				if ( tipo !== 'all' && record.get('type') !== tipo ) return false;
				return termo === '' || record.get('name').toLowerCase().indexOf(termo) > -1;
			}
		});

		this.updateCatalogueCount();
	}

	,doTypeFilter: function() {
		this.applyCatalogueFilter();
	}

	,updateCatalogueCount: function() {
		var catalogo = Ext.getCmp('redilTab').down('#catalogue');
		var contagem = catalogo && catalogo.down('#catalogueCount');
		if ( !contagem ) return;

		var total = 0;
		Ext.getStore('ServicesList').each(function(record) {
			if ( record.get('type') !== 'custom' ) total++;
		});

		contagem.setHtml(total + (total === 1 ? ' service' : ' services'));
	}

	,onSearchServiceChange: function(field, newValue) {
		field.getTrigger('clear')[ Ext.isEmpty(newValue) ? 'hide' : 'show' ]();
		field.updateLayout();
		this.applyCatalogueFilter();
	}

	,onClearClick: function(field) {
		field.reset();
		field.getTrigger('clear').hide();
		field.updateLayout();
		this.applyCatalogueFilter();
	}

	,dontDisturb: function(btn, e, called) {
		console.info('Dont Disturb:', btn.pressed ? 'Enabled' : 'Disabled');

		Ext.Array.each(Ext.getStore('Services').collect('id'), function(serviceId) {
			// Get Tab
			var tab = Ext.getCmp('tab_'+serviceId);

			if ( !tab ) return; // Skip disabled services

			// Mute sounds
			tab.setAudioMuted(btn.pressed ? true : tab.record.get('muted'), true);

			// Prevent Notifications
			tab.setNotifications(btn.pressed ? false : tab.record.get('notifications'), true);
		});

		localStorage.setItem('dontDisturb', btn.pressed);

		ipc.send('setDontDisturb', btn.pressed);

		// The rail shows icons only, so the state goes in the tooltip. This used to
		// call setText, from when the button lived on a horizontal bar.
		btn.setTooltip(locale['app.main[16]'] + ': ' + ( btn.pressed ? locale['app.window[20]'] : locale['app.window[21]'] ));

		// var btn_icon = document.getElementById('disturbBtn-btnIconEl');
		// btn_icon.innerHTML = btn.pressed ? "" : "";

		btn.pressed ? btn.setGlyph('xf1f7@FontAwesome') : btn.setGlyph('xf0f3@FontAwesome');

		Ext.getCmp('mainTabBar').getEl().toggleCls('dontdisturb');

		// If this method is called from Lock method, prevent showing toast
		if ( !e ) return;
		Ext.toast({
			 html: btn.pressed ? 'ENABLED' : 'DISABLED'
			,title: 'Don\'t Disturb'
			,width: 200
			,align: 't'
			,closable: false
		});
	}

	,lockRedil: function(btn) {
		var me = this;

		if ( ipc.sendSync('getConfig').master_password ) {
			Ext.Msg.confirm(locale['app.main[19]'], 'Do you want to use the Master Password as your temporal password?', function(btnId) {
				if ( btnId === 'yes' ) {
					setLock(ipc.sendSync('getConfig').master_password);
				} else {
					showTempPass();
				}
			});
		} else {
			showTempPass();
		}

		function showTempPass() {
			var msgbox = Ext.Msg.prompt(locale['app.main[19]'], locale['app.window[22]'], function(btnId, text) {
				if ( btnId === 'ok' ) {
					var msgbox2 = Ext.Msg.prompt(locale['app.main[19]'], locale['app.window[23]'], function(btnId, text2) {
						if ( btnId === 'ok' ) {
							if ( text !== text2 ) {
								Ext.Msg.show({
									 title: locale['app.window[24]']
									,message: locale['app.window[25]']
									,icon: Ext.Msg.WARNING
									,buttons: Ext.Msg.OK
									,fn: me.lockRedil
								});
								return false;
							}

							setLock(Redil.util.MD5.encypt(text));
						}
					});
					msgbox2.textField.inputEl.dom.type = 'password';
				}
			});
			msgbox.textField.inputEl.dom.type = 'password';
		}

		function setLock(text) {
			var redilTab = Ext.cq1('#redilTab');

			// Related to issue #2065. Focusing in an sub frame is a workaround
			if (redilTab.getWebView) {
				redilTab.down('component').el.dom.executeJavaScript(`
				var iframeFix = document.createElement('iframe');
				document.body.appendChild(iframeFix);
				iframeFix.focus();
				document.body.removeChild(iframeFix);
				`);
			}
			console.info('Lock Redil:', 'Enabled');

			// Save encrypted password in localStorage to show locked when app is reopen
			localStorage.setItem('locked', text);

			me.lookupReference('disturbBtn').setPressed(true);
			me.dontDisturb(me.lookupReference('disturbBtn'), false, true);

			me.showLockWindow();
		}
	}

	,showLockWindow: function() {
		var me = this;

		var validateFn = function() {
			if ( localStorage.getItem('locked') === Redil.util.MD5.encypt(winLock.down('textfield').getValue()) ) {
				console.info('Lock Redil:', 'Disabled');
				localStorage.removeItem('locked');
				winLock.close();
				me.lookupReference('disturbBtn').setPressed(false);
				me.dontDisturb(me.lookupReference('disturbBtn'), false);
			} else {
				winLock.down('textfield').reset();
				winLock.down('textfield').markInvalid('Unlock password is invalid');
			}
		};

		var winLock = Ext.create('Ext.window.Window', {
			 maximized: true
			,closable: false
			,resizable: false
			,minimizable: false
			,maximizable: false
			,draggable: false
			,onEsc: Ext.emptyFn
			,layout: 'center'
			,bodyStyle: 'background-color:#2e658e;'
			,items: [
				{
					 xtype: 'container'
					,layout: 'vbox'
					,items: [
						{
							 xtype: 'image'
							,src: 'resources/Icon.png'
							,width: 256
							,height: 256
						}
						,{
							 xtype: 'component'
							,autoEl: {
								 tag: 'h1'
								,html: locale['app.window[26]']
								,style: 'text-align:center;width:256px;'
						   }
						}
						,{
							 xtype: 'textfield'
							,inputType: 'password'
							,width: 256
							,listeners: {
								specialkey: function(field, e){
									if ( e.getKey() == e.ENTER ) {
										validateFn();
									}
								}
							}
						}
						,{
							 xtype: 'button'
							,text: locale['app.window[27]']
							,glyph: 'xf13e@FontAwesome'
							,width: 256
							,scale: 'large'
							,handler: validateFn
						}
					]
				}
			]
			,listeners: {
				render: function(win) {
					win.getEl().on('click', function() {
						win.down('textfield').focus(100);
					});
				}
			}
		}).show();
		winLock.down('textfield').focus(1000);
	}

	,openPreferences: function( btn ) {
		Ext.create('Redil.view.preferences.Preferences').show();
	}
});
