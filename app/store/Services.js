Ext.define('Shep.store.Services', {
	 extend: 'Ext.data.Store'
	,alias: 'store.services'

	,requires: [
		 'Ext.data.proxy.LocalStorage'
		,'Shep.util.ServiceIcon'
	]

	,model: 'Shep.model.Service'

	,autoLoad: false
	,autoSync: true
	,pageSize: 0

	,groupField: 'align'
	,sorters: [
		{
			 property: 'position'
			,direction: 'ASC'
		}
	]

	,listeners: {
		 load: function( store, records, successful ) {
			Ext.cq1('app-main').suspendEvent('add');

			var servicesLeft = [];
			var servicesRight = [];
			store.each(function(service) {
				// A disabled service keeps its place in the rail, greyed: its icon's
				// right click is where it is turned back on.
				var cfg = {
					 xtype: 'webview'
					,id: 'tab_'+service.get('id')
					,title: service.get('name')
					,icon: Shep.util.ServiceIcon.describe(service).url
					,src: service.get('url')
					,type: service.get('type')
					,muted: service.get('muted')
					,includeInGlobalUnreadCounter: service.get('includeInGlobalUnreadCounter')
					,displayTabUnreadCounter: service.get('displayTabUnreadCounter')
					,enabled: service.get('enabled')
					,record: service
					,tabConfig: {
						service: service
					}
				};

				service.get('align') === 'left' ? servicesLeft.push(cfg) : servicesRight.push(cfg);
			});

			if ( !Ext.isEmpty(servicesLeft) ) Ext.cq1('app-main').insert(1, servicesLeft);
			if ( !Ext.isEmpty(servicesRight) ) Ext.cq1('app-main').add(servicesRight);

			// before the default service is chosen, which must be one on show
			Shep.util.Workspaces.apply();

			// Set default active service
			const config = ipc.sendSync('getConfig');
			switch ( config.default_service ) {
				case 'last':
					var last = Ext.getCmp(localStorage.getItem('last_active_service'));
					if ( last && !(last.tab && last.tab.isHidden()) ) Ext.cq1('app-main').setActiveTab(last);
					break;
				case 'shepTab':
					break;
				default:
					if ( Ext.getCmp('tab_'+config.default_service) ) Ext.cq1('app-main').setActiveTab('tab_'+config.default_service);
					break;
			}

			store.suspendEvent('load');
			Ext.cq1('app-main').resumeEvent('add');
		}
		,datachanged: function(store, eOpts) {
			var isEmpty = store.getCount() > 0 ? false : true;
			Ext.cq1('app-main').getViewModel().set('emptyServices', isEmpty);
		}
	}
});
