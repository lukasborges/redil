Ext.define('Shep.view.add.Add',{
	 extend: 'Ext.window.Window'

	,requires: [
		 'Shep.view.add.AddController'
		,'Shep.view.add.AddModel'
		,'Shep.util.ServiceIcon'
	]

	,controller: 'add-add'
	,viewModel: {
		type: 'add-add'
	}

	// private
	,record: null
	,edit: false

	// defaults
	,modal: true
	,width: 500
	,autoShow: true
	,resizable: false
	,draggable: false
	,bodyPadding: 20

	,initComponent: function() {
		var me = this;
		var record = me.record;

		me.title = me.edit ? locale['app.window[1]'] + ' ' + record.get('name') : locale['app.window[10]'];
		if ( me.edit ) me.icon = Shep.util.ServiceIcon.describe(record).url;
		me.items = [
			{
				 xtype: 'form'
				,cls: 'rx-plain'
				,items: [
					{
						 xtype: 'textfield'
						,fieldLabel: locale['app.window[17]']
						,labelAlign: 'top'
						,labelSeparator: ''
						,anchor: '100%'
						,name: 'url'
						,value: me.edit ? record.get('url') : ''
						,emptyText: 'web.whatsapp.com'
						,allowBlank: false
						,validator: function(v) {
							return Shep.view.add.AddController.normalizeUrl(v) ? true : 'Type the address of the service, such as web.whatsapp.com';
						}
						,listeners: { specialkey: 'onEnter' }
					}
					,{
						 xtype: 'textfield'
						,fieldLabel: locale['app.window[2]']
						,labelAlign: 'top'
						,labelSeparator: ''
						,anchor: '100%'
						,margin: '10 0 0 0'
						,name: 'serviceName'
						,value: me.edit ? record.get('name') : ''
						,emptyText: 'Taken from the address when left empty'
						,allowBlank: true
						,listeners: { specialkey: 'onEnter' }
					}
					,{
						/*
						 * One workspace or none. A new service joins the workspace on
						 * screen, which is where somebody adding one expects to find it.
						 */
						 xtype: 'combobox'
						,fieldLabel: 'Workspace'
						,name: 'workspace'
						,hidden: Ext.isEmpty(Shep.util.Workspaces.list())
						,editable: false
						,queryMode: 'local'
						,displayField: 'name'
						,valueField: 'id'
						,store: {
							 fields: ['id', 'name']
							,data: [{ id: '', name: 'All' }].concat(Shep.util.Workspaces.list())
						}
						,value: me.edit ? record.get('workspace') : Shep.util.Workspaces.getActive()
						,labelAlign: 'top'
						,labelSeparator: ''
						,anchor: '100%'
						,margin: '10 0 0 0'
					}
				]
			}
		];

		me.buttons = [
			{
				 text: locale['button[1]']
				,ui: 'decline'
				,handler: 'doCancel'
			}
			,'->'
			,{
				// The window is already titled "Edit Google Meet"; the button says
				// what it does, not where it is.
				 text: me.edit ? locale['button[4]'] : locale['app.window[10]']
				,itemId: 'submit'
				,handler: 'doSave'
			}
		];

		this.callParent(this);
	}

	,listeners: {
		show: 'onShow'
	}
});
