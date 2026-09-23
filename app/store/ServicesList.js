Ext.define('Shep.store.ServicesList', {
	 extend: 'Ext.data.Store'
	,alias: 'store.serviceslist'

	,requires: [
		'Ext.data.proxy.LocalStorage'
	]

	,model: 'Shep.model.ServiceList'

	,proxy: {
		type: 'ajax',
		url: 'resources/services.json',
		reader: {
			type: 'json',
			rootProperty: 'responseText'
		}
	}
	,listeners: {
		load: function () {
			Ext.get('spinner') ? Ext.get('spinner').destroy() : null;
			Ext.get('background') ? Ext.get('background').destroy() : null;
			this.add({
			 	id: 'custom'
				,logo: 'custom.png'
				,name: 'Custom Service'
				,description: locale['services[38]']
				,url: '___'
				,type: 'custom'
				,allow_popups: true
			})
		}
	}
	,sorters: [{
		/*
		 * The custom entry is not a service, it is the way out when the
		 * catalogue does not carry one, so it stays at the end of the list.
		 * Upstream did that by naming it '_Custom Service', which then read
		 * back out of the record in the Add window's title.
		 */
		sorterFn: function(a, b) {
			if ( a.get('type') === 'custom' ) return 1;
			if ( b.get('type') === 'custom' ) return -1;
			return a.get('name').localeCompare(b.get('name'));
		}
	}]

	,autoLoad: true
	,autoSync: true
	,pageSize: 100000
});
