Ext.define('Shep.view.add.AddController', {
	extend: 'Ext.app.ViewController',
	alias: 'controller.add-add',

	requires: [
		 'Shep.util.UnreadCounter'
		,'Shep.util.ServiceIcon'
	],

	statics: {
		normalizeUrl: function(value) {
			var typed = Ext.String.trim(value || '');
			if ( !typed ) return null;
			if ( !/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ) typed = 'https://' + typed;

			try {
				var url = new URL(typed);
				if ( !['http:', 'https:'].includes(url.protocol) ) return null;
				if ( url.hostname !== 'localhost' && url.hostname.indexOf('.') === -1 ) return null;
				return url.href;
			} catch (e) {
				return null;
			}
		}

		,nameFromUrl: function(value) {
			var labels = new URL(value).hostname.split('.');
			var generic = ['www', 'web', 'app', 'm'];
			var isCountryUnderShortSecondLevel = labels.length > 2 && labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3;
			var siteAt = isCountryUnderShortSecondLevel ? labels.length - 3 : labels.length - 2;
			var capitalize = function(word) { return word.charAt(0).toUpperCase() + word.slice(1); };

			if ( siteAt < 0 ) return capitalize(labels[0]);
			var site = capitalize(labels[siteAt]);
			var sub = labels.slice(0, siteAt).filter(function(label) { return generic.indexOf(label) === -1; });
			return sub.length ? site + ' ' + capitalize(sub[sub.length - 1]) : site;
		}
	},

	doCancel: function( btn ) {
		var me = this;

		me.getView().close();
	}

	,doSave: function( btn ) {
		var me = this;

		var win = me.getView();
		if ( !win.down('form').isValid() ) return false;

		var formValues = win.down('form').getValues();
		var statics = Shep.view.add.AddController;
		formValues.url = statics.normalizeUrl(formValues.url);
		formValues.serviceName = Ext.String.trim(formValues.serviceName || '') || statics.nameFromUrl(formValues.url);

		if ( win.edit ) {
			var oldData = win.record.getData();
			win.record.set({
				 name: formValues.serviceName
				,url: formValues.url
				,workspace: formValues.workspace || ''
			});

			var view = Ext.getCmp('tab_'+win.record.get('id'));

			// The rail shows icons only, so the name is the tooltip rather than a
			// title; the per-service tabname option went with the labels. The
			// tooltip belongs to the tab, which is a button: a panel has no
			// setTooltip, and calling it here threw before anything was saved.
			view.tab.setTooltip( formValues.serviceName );
			var wearsInitials = !win.record.get('favicon');
			if ( wearsInitials && oldData.name !== formValues.serviceName ) view.setIcon(Shep.util.ServiceIcon.describe(win.record).url);
			// Change the URL of the Tab
			if ( oldData.url !== formValues.url ) view.setURL(formValues.url);

			view.record = win.record;
			view.tabConfig.service = win.record;

			view.refreshUnreadCount();
		} else {
			var service = Ext.create('Shep.model.Service', {
				 type: 'custom'
				,logo: ''
				,name: formValues.serviceName
				,url: formValues.url
				,media: false
				,workspace: formValues.workspace || ''
			});
			service.save();
			Ext.getStore('Services').add(service);

			var tabData = {
				 xtype: 'webview'
				,id: 'tab_'+service.get('id')
				,record: service
				,tabConfig: {
					service: service
				}
			};

			var tbfill = Ext.cq1('app-main').getTabBar().down('tbfill');
			Ext.cq1('app-main').insert(Ext.cq1('app-main').getTabBar().items.indexOf(tbfill), tabData).show();

			// a service added to a workspace that is not on screen takes you there,
			// or it would vanish from the rail the moment it was added
			var workspaces = Shep.util.Workspaces;
			if ( !workspaces.isVisible(service, workspaces.getActive()) ) workspaces.setActive(service.get('workspace'));
		}

		// a service moved to another workspace leaves the rail
		Shep.util.Workspaces.apply();

		win.close();
	}

	,onEnter: function(field, e) {
		var me = this;

		if ( e.getKey() == e.ENTER && field.up('form').isValid() ) me.doSave();
	}

	,onShow: function(win) {
		win.down('textfield[name="url"]').focus(true, 100);
	}
});
