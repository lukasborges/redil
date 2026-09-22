Ext.define('Redil.model.ServiceList', {
	 extend: 'Ext.data.Model'

	,fields: [{
		 name: 'id'
		,type: 'string'
	},{
		 name: 'logo'
		,type: 'string'
	},{
		 name: 'name'
		,type: 'string'
	},{
		 name: 'description'
		,type: 'string'
		,defaultValue: locale['services[27]']
	},{
		 name: 'url'
		,type: 'string'
	},{
		 name: 'type'
		,type: 'string'
	},{
		 name: 'js_unread'
		,type: 'string'
		,defaultValue: ''
	},{
		 name: 'titleBlink'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'allow_popups'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'manual_notifications'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'userAgent'
		,type: 'string'
		,defaultValue: ''
	},{
		 name: 'note'
		,type: 'string'
		,defaultValue: ''
	},{
		 name: 'custom_domain'
		,type: 'boolean'
		,defaultValue: false
	},{
		/*
		 * The service's own purpose includes calls, so a person who adds it is
		 * asking for a camera and a microphone. It seeds the per-service setting
		 * in the Add window and nothing else; the answer that counts lives on
		 * the configured service, where it can be changed.
		 */
		 name: 'media'
		,type: 'boolean'
		,defaultValue: false
	}]
});
