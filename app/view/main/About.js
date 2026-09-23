Ext.define('Shep.view.main.About', {
	 extend: 'Ext.window.Window'
	,xtype: 'about'
	,title: locale['app.about[0]']
	,autoShow: true
	,modal: true
	,resizable: false
	,constrain: true
	,width: 300
	,height: 450
	,bodyPadding: 10
	,data: {
		 version: shep.ipc.sendSync('app:getVersion')
		,platform: shep.platform
		,arch: shep.arch
		,electron: shep.versions.electron
		,chromium: shep.versions.chrome
		,node: shep.versions.node
	}
	,tpl: [
		 '<div style="text-align:center;"><img src="resources/Icon.png" width="100" /></div>'
		,'<h3>'+locale['app.about[1]']+'</h3>'
		,'<div><b>'+locale['app.about[2]']+':</b> {version}</div>'
		,'<div><b>'+locale['app.about[3]']+':</b> {platform} ({arch})</div>'
		,'<div><b>Electron:</b> {electron}</div>'
		,'<div><b>Chromium:</b> {chromium}</div>'
		,'<div><b>Node:</b> {node}</div>'
		,'<br />'
		,'<div style="text-align:center;"><a href="https://github.com/lukasborges/shep" target="_blank">GitHub</a></div>'
		,'<br />'
		// Both credits, in the right order. The donate button and rambox.pro that
		// stood here belong to the product Ramiro Saenz sells, not to this fork.
		,'<div style="text-align:center;"><i>Shep by Lucas Borges</i></div>'
		,'<div style="text-align:center; font-size:11px; color:#5B7183;"><i>fork of Rambox CE by Ramiro Saenz</i></div>'
	]
});
