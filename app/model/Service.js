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
		/*
		 * Camera, microphone and screen sharing without a prompt. Three states,
		 * not two: null means nobody has decided, so the catalogue's own flag
		 * answers, which is what makes a service added before this field existed
		 * -- or before its catalogue entry was marked -- work without being
		 * edited. Saving the Add window always writes true or false, so a person
		 * who turns it off is not overruled by the catalogue later.
		 */
		 name: 'media'
		,type: 'boolean'
		,allowNull: true
		,defaultValue: null
	},{
		 name: 'enabled'
		,type: 'boolean'
		,defaultValue: true
	},{
		// The id of the workspace it belongs to, or '' for none, which means it
		// is shown in every workspace. See Redil.util.Workspaces.
		 name: 'workspace'
		,type: 'string'
		,defaultValue: ''
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
