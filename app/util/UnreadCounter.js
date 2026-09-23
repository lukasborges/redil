/**
 * Singleton class to handle the global unread counter.
 */
Ext.define('Redil.util.UnreadCounter', {

	singleton: true,

	constructor: function(config) {

		config = config || {};

		/**
		 * Map for storing the global unread count.
		 * service id -> unread count
		 *
		 * @type {Map}
		 */
		var unreadCountByService = new Map();

		/**
		 * Services that can say there is something waiting but not how much.
		 * Google Chat is the case: it puts no count in its title and its own
		 * markup is generated class names, but it swaps its favicon for one
		 * named favicon_chat_new_notif_*.ico, which is a yes or no.
		 *
		 * @type {Set}
		 */
		var servicesWithSomething = new Set();

		/**
		 * Holds the global unread count for internal usage.
		 *
		 * @type {number}
		 */
		var totalUnreadCount = 0;

		/**
		 * Sets the application's unread count to tracked unread count.
		 */
		function updateAppUnreadCounter() {
			Redil.app.setTotalNotifications(totalUnreadCount);
		}

		/**
		 * Returns the global unread count.
		 *
		 * @return {number}
		 */
		this.getTotalUnreadCount = function() {
			return totalUnreadCount;
		};

		/**
		 * Whether a service is saying "there is something" without a number.
		 *
		 * @param {*} id	Id of the service.
		 * @return {boolean}
		 */
		this.hasSomethingUnread = function(id) {
			return servicesWithSomething.has(id);
		};

		/**
		 * Records that answer. It is deliberately outside the total: a dot cannot
		 * be added to a number, and the taskbar badge is a number.
		 *
		 * @param {*} id		Id of the service.
		 * @param {boolean} on	Whether it has something waiting.
		 */
		this.setSomethingUnreadForService = function(id, on) {
			on ? servicesWithSomething.add(id) : servicesWithSomething.delete(id);
		};

		/**
		 * Sets the global unread count for a specific service.
		 *
		 * @param {*} id				Id of the service to set the global unread count for.
		 * @param {number} unreadCount	The global unread count for the service.
		 */
		this.setUnreadCountForService = function(id, unreadCount) {
			unreadCount = parseInt(unreadCount, 10);

			if (unreadCountByService.has(id)) {
				totalUnreadCount -= unreadCountByService.get(id);
			}
			totalUnreadCount += unreadCount;
			unreadCountByService.set(id, unreadCount);

			updateAppUnreadCounter();
		};

		/**
		 * Clears the global unread count for a specific service.
		 *
		 * @param {*} id	Id of the service to clear the global unread count for.
		 */
		this.clearUnreadCountForService = function(id) {
			if (unreadCountByService.has(id)) {
				totalUnreadCount -= unreadCountByService.get(id);
			}
			unreadCountByService['delete'](id);

			updateAppUnreadCounter();
		}
	}
});
