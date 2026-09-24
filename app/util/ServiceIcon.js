Ext.define('Shep.util.ServiceIcon', {
	 singleton: true

	,FAVICON_CLS: 'rx-tab-favicon'

	,FAVICON_WIDTH_SHARP_AT_24PX_ON_2X: 48

	,describe: function(record) {
		var favicon = record.get('favicon');
		if ( favicon ) return { url: favicon, cls: this.FAVICON_CLS };

		var logo = record.get('logo');
		if ( /^(https?|data):/.test(logo || '') ) return { url: logo, cls: '' };

		return { url: this.initialsImage(record.get('name') || record.get('url')), cls: '' };
	}

	,initialsImage: function(name) {
		var initials = Shep.util.Workspaces.initials(name || '?');
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">'
			+ '<rect width="30" height="30" rx="7" fill="#5B7183"/>'
			+ '<text x="15" y="15" dy=".35em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#FFFFFF">'
			+ Ext.String.htmlEncode(initials)
			+ '</text></svg>';
		return 'data:image/svg+xml,' + encodeURIComponent(svg);
	}

	,pickFavicon: function(dataUrls) {
		return Promise.all((dataUrls || []).map(function(url) {
			return new Promise(function(resolve) {
				var probe = new Image();
				var isVector = /^data:image\/svg/.test(url);
				probe.onload = function() { resolve({ url: url, width: isVector ? Infinity : probe.naturalWidth || 0 }); };
				probe.onerror = function() { resolve(null); };
				probe.src = url;
			});
		})).then(function(probes) {
			var loaded = probes.filter(Boolean);
			if ( !loaded.length ) return null;

			var sharpWidth = Shep.util.ServiceIcon.FAVICON_WIDTH_SHARP_AT_24PX_ON_2X;
			var sharp = loaded.filter(function(p) { return p.width >= sharpWidth; });
			var byWidth = function(a, b) { return a.width - b.width; };
			return sharp.length ? sharp.sort(byWidth)[0].url : loaded.sort(byWidth).pop().url;
		});
	}
});
