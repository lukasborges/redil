/**
 * The icon a service wears in the rail, the title bar and its disabled card.
 *
 * It is the page's own favicon, live, so a service that marks something new by
 * swapping it, as Google Chat does, shows it in the rail. It is kept on the
 * record once the page has shown one, because a service that is disabled or
 * not loaded yet has no page to ask.
 * Before that, a service added from the catalogue that used to exist wears the
 * catalogue's picture, and any other wears its initials.
 */
Ext.define('Shep.util.ServiceIcon', {
	 singleton: true

	// A favicon is drawn at 24px rather than stretched over the whole square;
	// see .rx-tab-favicon.
	,FAVICON_CLS: 'rx-tab-favicon'

	// Twice the size .rx-tab-favicon draws a favicon at, which is what a 2x
	// screen needs to draw it sharp.
	,SHARP_FROM: 48

	,describe: function(record) {
		var favicon = record.get('favicon');
		if ( favicon ) return { url: favicon, cls: this.FAVICON_CLS };

		var logo = record.get('logo');
		if ( logo ) return { url: /^(https?|data):/.test(logo) ? logo : 'resources/icons/' + logo, cls: '' };

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

	/**
	 * Of the favicons a page lists, the smallest that is still sharp at 24 CSS
	 * pixels on a 2x screen, or the largest when none is. Resolves to null when
	 * none of them loads.
	 */
	,pickFavicon: function(dataUrls) {
		return Promise.all((dataUrls || []).map(function(url) {
			return new Promise(function(resolve) {
				var probe = new Image();
				// A vector favicon is sharp at any size.
				probe.onload = function() { resolve({ url: url, width: /^data:image\/svg/.test(url) ? Infinity : probe.naturalWidth || 0 }); };
				probe.onerror = function() { resolve(null); };
				probe.src = url;
			});
		})).then(function(probes) {
			var loaded = probes.filter(Boolean);
			if ( !loaded.length ) return null;

			var sharpFrom = Shep.util.ServiceIcon.SHARP_FROM;
			var sharp = loaded.filter(function(p) { return p.width >= sharpFrom; });
			var byWidth = function(a, b) { return a.width - b.width; };
			return sharp.length ? sharp.sort(byWidth)[0].url : loaded.sort(byWidth).pop().url;
		});
	}
});
