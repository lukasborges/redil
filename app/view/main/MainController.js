Ext.define('Shep.view.main.MainController', {
	 extend: 'Ext.app.ViewController'

	,alias: 'controller.main'

	,initialize: function( tabPanel ) {
		// Fixed, in the shape Franz and Station settled on: a vertical rail of
		// icons. The four-sided tabbar_location preference went with it.
		tabPanel.setTabPosition('left');
		tabPanel.setTabRotation(0);

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

		if ( newTab.id === 'shepTab' ) {
			if ( Shep.app.getTotalNotifications() > 0 ) {
				document.title = 'Shep ('+ Shep.app.getTotalNotifications() +')';
			} else {
				document.title = 'Shep';
			}
			return;
		}

		if (!newTab.record.get('enabled') ) {
			return;
		}

		var webview = newTab.down('component').el.dom;

		setTimeout(function () {
			// Whoever is active in 300ms may not be this tab any more.
			if ( !webview || tabPanel.getActiveTab() !== newTab ) return;

			newTab.getWebView().blur();
			newTab.getWebView().focus();
		}, 300);

		// Update the main window so it includes the active tab title.
		if ( Shep.app.getTotalNotifications() > 0 ) {
			document.title = 'Shep ('+ Shep.app.getTotalNotifications() +') - ' + newTab.record.get('name');
		} else {
			document.title = 'Shep - ' + newTab.record.get('name');
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
			identity.update('<b>Shep</b>');
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
		if ( tab.id === 'shepTab' || tab.id === 'tbfill' ) return true;

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
			if ( t.id === 'shepTab' || !t.record ) return;

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

	,openAddService: function() {
		Ext.create('Shep.view.add.Add');
	}

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
						 fields: ['name', 'title', 'total']
						,data: linhas
					})
					,itemSelector: 'div.rx-report-row'
					,tpl: [
						 '<div class="rx-report-head">'
							,'<span class="rx-report-name">Service</span>'
							,'<span>Title</span><span>Total</span>'
						,'</div>'
						,'<tpl for=".">'
							,'<div class="rx-report-row">'
								,'<span class="rx-report-name">{name}</span>'
								,'<span class="rx-report-title">{title}</span>'
								,'<span>{total}</span>'
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
							return [l.name, l.title, l.total].join('\t');
						}).join('\n');
						ipc.send('clipboard:writeText', texto);
					}
				}
				,{ xtype: 'tbfill' }
				,{ text: locale['button[0]'], handler: function(b) { b.up('window').close(); } }
			]
		}).show();
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
		if ( config.default_service === rec.get('id') ) ipc.send('setConfig', Ext.apply(config, { default_service: 'shepTab' }));

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
					document.title = 'Shep';

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
		Ext.create('Shep.view.add.Add', {
			 record: rec
			,edit: true
		});
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
		// One line, one at a time, and quick: Ext's own toast slides in over a
		// second and a half and stacks a new one under the last
		if ( this.disturbToast && !this.disturbToast.destroyed ) this.disturbToast.destroy();
		this.disturbToast = Ext.toast({
			 html: '<span class="rx-toast-glyph">' + (btn.pressed ? '&#xf1f7;' : '&#xf0f3;') + '</span>' + locale['app.main[16]'] + ': ' + (btn.pressed ? locale['app.window[20]'] : locale['app.window[21]'])
			,cls: 'rx-toast'
			,header: false
			// a toast is 50px at least, which left one line of text sitting high
			,minHeight: 0
			,bodyPadding: '8 16'
			,align: 't'
			// clear of the 32px title bar
			,paddingY: 44
			,closable: false
			,shadow: false
			,slideInDuration: 150
			,hideDuration: 150
			,autoCloseDelay: 1500
		});
	}

	,lockShep: function(btn) {
		var me = this;

		// The master password locks without asking; without one, the password
		// chosen the first time is kept and every later lock reuses it
		var masterPassword = ipc.sendSync('getConfig').master_password;
		var lockPassword = masterPassword || localStorage.getItem('lock_password');
		if ( lockPassword ) {
			setLock(lockPassword);
		} else {
			askLockPassword();
		}

		function askLockPassword() {
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
									,fn: me.lockShep
									,scope: me
								});
								return false;
							}

							localStorage.setItem('lock_password', Shep.util.MD5.encypt(text));
							setLock(localStorage.getItem('lock_password'));
						}
					});
					msgbox2.textField.inputEl.dom.type = 'password';
				}
			});
			msgbox.textField.inputEl.dom.type = 'password';
		}

		function setLock(text) {
			var shepTab = Ext.cq1('#shepTab');

			// Related to issue #2065. Focusing in an sub frame is a workaround
			if (shepTab.getWebView) {
				shepTab.down('component').el.dom.executeJavaScript(`
				var iframeFix = document.createElement('iframe');
				document.body.appendChild(iframeFix);
				iframeFix.focus();
				document.body.removeChild(iframeFix);
				`);
			}
			console.info('Lock Shep:', 'Enabled');

			// Save encrypted password in localStorage to show locked when app is reopen
			localStorage.setItem('locked', text);

			me.lookupReference('disturbBtn').setPressed(true);
			me.dontDisturb(me.lookupReference('disturbBtn'), false, true);

			me.showLockWindow();
		}
	}

	// The same screen masterpassword.html draws before the app opens, from the
	// same .rx-lock rules, so the two locks cannot drift apart again
	,showLockWindow: function() {
		var me = this;
		var withMaster = localStorage.getItem('locked') === ipc.sendSync('getConfig').master_password;

		var winLock = Ext.create('Ext.window.Window', {
			 maximized: true
			,header: false
			,border: false
			,shadow: false
			,closable: false
			,resizable: false
			,draggable: false
			,onEsc: Ext.emptyFn
			,cls: 'rx-lock-window'
			,bodyStyle: 'background: transparent;'
			,html: [
				 '<div class="rx-lock">'
				,	'<img class="rx-lock-mark" src="resources/Mark.png" alt="">'
				,	'<h1 class="rx-lock-title">' + locale['app.window[26]'] + '</h1>'
				,	'<p class="rx-lock-hint">Enter your ' + (withMaster ? 'master' : 'lock') + ' password to carry on.</p>'
				,	'<form class="rx-lock-form">'
				,		'<input class="rx-lock-field" type="password" placeholder="' + (withMaster ? 'Master' : 'Lock') + ' password">'
				,		'<button class="rx-lock-unlock" type="submit">Unlock</button>'
				,	'</form>'
				,	'<p class="rx-lock-wrong" hidden>That password is not right. Try again.</p>'
				,	'<a class="rx-lock-exit" href="#">Exit Shep</a>'
				,'</div>'
			].join('')
			,listeners: {
				afterrender: function(win) {
					var root = win.body.dom;
					var field = root.querySelector('.rx-lock-field');
					var wrong = root.querySelector('.rx-lock-wrong');

					root.querySelector('.rx-lock-form').addEventListener('submit', function(e) {
						e.preventDefault();
						if ( localStorage.getItem('locked') === Shep.util.MD5.encypt(field.value) ) {
							console.info('Lock Shep:', 'Disabled');
							localStorage.removeItem('locked');
							win.close();
							// Ext hands focus back to the lock button, which then wears a
							// focus ring across the rail as if it had been reached by Tab
							Ext.getCmp('lockShepBtn').blur();
							me.lookupReference('disturbBtn').setPressed(false);
							me.dontDisturb(me.lookupReference('disturbBtn'), false);
						} else {
							field.value = '';
							wrong.hidden = false;
							field.focus();
						}
					});
					field.addEventListener('input', function() { wrong.hidden = true; });
					root.querySelector('.rx-lock-exit').addEventListener('click', function(e) {
						e.preventDefault();
						ipc.send('app:quit');
					});
					// a click anywhere puts the caret back, as the page's autofocus does
					root.addEventListener('click', function(e) {
						if ( e.target.classList.contains('rx-lock') ) field.focus();
					});
					Ext.defer(function() { field.focus(); }, 100);
				}
			}
		}).show();
	}
	,openPreferences: function( btn ) {
		Ext.create('Shep.view.preferences.Preferences').show();
	}
});
