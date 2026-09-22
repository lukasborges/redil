Ext.define('Redil.model.Service', {
	 extend: 'Ext.data.Model'

	,identifier: 'sequential'
	,proxy: {
		 type: 'localstorage'
		,id: 'services'
	}

	,fields: [{
		 name: 'id'
		,type: 'int'
	},{
		 name: 'position'
		,type: 'int'
	},{
		 name: 'type'
		,type: 'string'
	},{
		 name: 'logo'
		,type: 'string'
	},{
		 name: 'name'
		,type: 'string'
	},{
		 name: 'url'
		,type: 'string'
	},{
		 name: 'align'
		,type: 'string'
		,defaultValue: 'left'
	},{
		 name: 'notifications'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'muted'
		,type: 'boolean'
		,defaultValue: false
	},{
		// Nothing reads this any more: the rail shows icons only. The field stays
		// so records written before that keep their shape.
		 name: 'tabname'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'statusbar'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'displayTabUnreadCounter'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'includeInGlobalUnreadCounter'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'trust'
		,type: 'boolean'
		,defaultValue: false
	},{
		// Camera, microphone and screen sharing without a prompt. Seeded from the
		// catalogue for the services whose whole job is calls; false for anything
		// added before this field existed, which keeps the prompt.
		 name: 'media'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'enabled'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'js_unread'
		,type: 'string'
		,defaultValue: ''
	},{
		 name: 'zoomLevel'
		,type: 'number'
		,defaultValue: 0
	}]
});
