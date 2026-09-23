/**
 * Workspaces: named groups of services, one of which the rail shows at a time.
 *
 * A service belongs to one workspace or to none, and one that belongs to none
 * is shown in all of them -- the chat app a person keeps open whatever they are
 * doing. "All services" is not a workspace but the absence of a filter.
 *
 * The list and the choice live in localStorage beside the services themselves,
 * so the two travel together and the main process never needs to know.
 *
 * The switcher at the top of the rail is not one of the tab bar's items. Ext
 * places a tab at the same index in the bar as its card has in the panel, so
 * an item ahead of the tabs would put every service one place out; it is drawn
 * into the bar's element instead, in room the stylesheet keeps free for it.
 */
Ext.define('Redil.util.Workspaces', {
	 singleton: true

	,requires: [
		'Redil.util.UnreadCounter'
	]

	,list: function() {
		try {
			var stored = JSON.parse(localStorage.getItem('workspaces'));
			return Ext.isArray(stored) ? stored : [];
		} catch (e) {
			return [];
		}
	}

	,save: function(workspaces) {
		localStorage.setItem('workspaces', JSON.stringify(workspaces));
	}

	,get: function(id) {
		return Ext.Array.findBy(this.list(), function(workspace) { return workspace.id === id; }) || null;
	}

	// '' is "All services"; a workspace that has since been deleted reads as that
	,getActive: function() {
		var id = localStorage.getItem('active_workspace') || '';
		return this.get(id) ? id : '';
	}

	,setActive: function(id) {
		localStorage.setItem('active_workspace', id || '');
		this.apply();
	}

	,create: function(name) {
		var workspaces = this.list();
		// the time alone is not unique: two created in the same millisecond, as a
		// script or a fast pair of clicks can, would share an id and a filter
		var workspace = { id: 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name };

		workspaces.push(workspace);
		this.save(workspaces);
		return workspace;
	}

	,rename: function(id, name) {
		this.save(Ext.Array.map(this.list(), function(workspace) {
			return workspace.id === id ? { id: id, name: name } : workspace;
		}));
		this.apply();
	}

	// The services in it are not removed: they belong to no workspace afterwards,
	// which means they are shown in all of them, so nothing disappears.
	,remove: function(id) {
		this.save(Ext.Array.filter(this.list(), function(workspace) { return workspace.id !== id; }));
		Ext.getStore('Services').each(function(service) {
			if ( service.get('workspace') === id ) service.set('workspace', '');
		});
		if ( localStorage.getItem('active_workspace') === id ) localStorage.setItem('active_workspace', '');
		this.apply();
	}

	,isVisible: function(service, active) {
		var workspace = service.get('workspace');
		return !active || !workspace || workspace === active;
	}

	// Every tab in the main panel that is a service, in rail order
	,serviceTabs: function() {
		var main = Ext.cq1('app-main');
		return main ? main.items.items.filter(function(item) { return !!item.record; }) : [];
	}

	// The services the rail is showing, for the shortcuts that count them
	,visibleServiceTabs: function() {
		return this.serviceTabs().filter(function(tab) { return !tab.tab.isHidden(); });
	}

	/**
	 * Shows the active workspace's services in the rail and hides the rest. The
	 * cards stay: hiding a service must not unload it, or its notifications and
	 * its unread count would stop while somebody works elsewhere.
	 */
	,apply: function() {
		var me = this;
		var main = Ext.cq1('app-main');
		if ( !main ) return;

		var active = me.getActive();
		Ext.each(me.serviceTabs(), function(tab) {
			tab.tab.setHidden(!me.isVisible(tab.record, active));
		});

		// the service on screen may just have left the rail
		var current = main.getActiveTab();
		if ( current && current.record && current.tab.isHidden() ) {
			var first = me.visibleServiceTabs()[0];
			main.setActiveTab(first || 'redilTab');
		}

		me.refreshSwitcher();
	}

	/**
	 * Mounts the switcher into the rail. Called once the tab bar is rendered.
	 */
	,mountSwitcher: function(tabBar) {
		var me = this;

		me.switcher = Ext.create('Ext.button.Button', {
			 renderTo: tabBar.el
			,id: 'workspaceSwitcher'
			,cls: 'rx-workspace-switcher'
			,arrowVisible: false
			// The items are built as the menu opens, so they are current. Ext will
			// not open an empty menu from a click, which is what this menu is until
			// then: without showEmptyMenu the switcher did nothing when clicked.
			,showEmptyMenu: true
			,menu: {
				 plain: true
				,cls: 'rx-workspace-menu'
				,items: []
				,listeners: {
					beforeshow: function(menu) { me.buildMenu(menu); }
				}
			}
		});
		me.refreshSwitcher();
	}

	/**
	 * The switcher shows the active workspace's initials, or a grid for all
	 * services, and a dot when a workspace that is not on screen has something
	 * unread: the rail only shows the badges of what it shows, so without the dot
	 * a message in the other workspace would be invisible until the taskbar badge
	 * was noticed.
	 */
	,refreshSwitcher: function() {
		var me = this;
		var btn = me.switcher;
		if ( !btn || !btn.rendered ) return;

		var active = me.get(me.getActive());
		btn.setText(active ? Ext.String.htmlEncode(me.initials(active.name)) : '');
		btn.setGlyph(active ? 0 : 'xf009@FontAwesome');
		btn.setTooltip(active ? Ext.String.htmlEncode(active.name) : 'All services');
		btn.el.toggleCls('rx-unread-elsewhere', me.hasUnreadElsewhere());
	}

	,initials: function(name) {
		var words = Ext.String.trim(name).split(/\s+/);
		return (words.length > 1 ? words[0].charAt(0) + words[1].charAt(0) : words[0].substr(0, 2)).toUpperCase();
	}

	,hasUnreadElsewhere: function() {
		var me = this;
		var active = me.getActive();
		if ( !active ) return false;

		return me.serviceTabs().some(function(tab) {
			if ( me.isVisible(tab.record, active) ) return false;
			var id = tab.record.get('id');
			return Redil.util.UnreadCounter.getUnreadCountForService(id) > 0 || Redil.util.UnreadCounter.hasSomethingUnread(id);
		});
	}

	// Which workspaces, other than the active one, have something waiting
	,unreadIn: function(workspaceId) {
		return this.serviceTabs().some(function(tab) {
			if ( tab.record.get('workspace') !== workspaceId ) return false;
			var id = tab.record.get('id');
			return Redil.util.UnreadCounter.getUnreadCountForService(id) > 0 || Redil.util.UnreadCounter.hasSomethingUnread(id);
		});
	}

	,buildMenu: function(menu) {
		var me = this;
		var active = me.getActive();
		var workspaces = me.list();
		var items = [];

		Ext.each(workspaces, function(workspace, index) {
			items.push({
				 text: Ext.String.htmlEncode(workspace.name)
					+ (me.unreadIn(workspace.id) && workspace.id !== active ? ' <span class="rx-menu-dot"></span>' : '')
					// Ext 5's menu items have no shortcut of their own to show
					+ (index < 9 ? '<span class="rx-menu-shortcut">' + (redil.platform === 'darwin' ? '⌘⌥' : 'Ctrl+Alt+') + (index + 1) + '</span>' : '')
				,checked: workspace.id === active
				,group: 'workspace'
				,handler: function() { me.setActive(workspace.id); }
			});
		});
		items.push({
			 text: 'All services' + (workspaces.length < 9 ? '<span class="rx-menu-shortcut">' + (redil.platform === 'darwin' ? '⌘⌥' : 'Ctrl+Alt+') + (workspaces.length + 1) + '</span>' : '')
			,checked: active === ''
			,group: 'workspace'
			,handler: function() { me.setActive(''); }
		});
		items.push('-');
		items.push({ text: 'New workspace…', glyph: 'xf067@FontAwesome', handler: function() { me.promptCreate(); } });
		if ( active ) {
			items.push({ text: 'Rename “' + Ext.String.htmlEncode(me.get(active).name) + '”…', glyph: 'xf040@FontAwesome', handler: function() { me.promptRename(active); } });
			items.push({ text: 'Delete “' + Ext.String.htmlEncode(me.get(active).name) + '”', glyph: 'xf1f8@FontAwesome', handler: function() { me.confirmRemove(active); } });
		}

		Ext.suspendLayouts();
		menu.removeAll();
		menu.add(items);
		Ext.resumeLayouts(true);
	}

	,promptCreate: function() {
		var me = this;
		Ext.Msg.prompt('New workspace', 'Name', function(btn, name) {
			name = Ext.String.trim(name || '');
			if ( btn !== 'ok' || !name ) return;
			me.setActive(me.create(name).id);
		});
	}

	,promptRename: function(id) {
		var me = this;
		Ext.Msg.prompt('Rename workspace', 'Name', function(btn, name) {
			name = Ext.String.trim(name || '');
			if ( btn === 'ok' && name ) me.rename(id, name);
		}, null, false, me.get(id).name);
	}

	,confirmRemove: function(id) {
		var me = this;
		Ext.Msg.confirm('Delete workspace', 'Delete “' + Ext.String.htmlEncode(me.get(id).name) + '”? Its services are kept and will show in every workspace.', function(btn) {
			if ( btn === 'yes' ) me.remove(id);
		});
	}

	// Ctrl+Alt+1..9: the Nth workspace; one past the last is "All services"
	,activateByNumber: function(n) {
		var workspaces = this.list();
		if ( n <= workspaces.length ) this.setActive(workspaces[n - 1].id);
		else if ( n === workspaces.length + 1 ) this.setActive('');
	}
});
