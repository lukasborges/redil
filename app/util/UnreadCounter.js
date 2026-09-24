/**
 * Singleton class to handle the global unread counter.
 */
Ext.define('Shep.util.UnreadCounter', {

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

		var servicesWithUncountedUnread = new Set();

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
			Shep.app.setTotalNotifications(totalUnreadCount);
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
		 * The count one service reported, 0 when it has reported none.
		 *
		 * @param {*} id	Id of the service.
		 * @return {number}
		 */
		this.getUnreadCountForService = function(id) {
			return unreadCountByService.get(id) || 0;
		};

		/**
		 * Whether a service is saying "there is something" without a number.
		 *
		 * @param {*} id	Id of the service.
		 * @return {boolean}
		 */
		this.hasSomethingUnread = function(id) {
			return servicesWithUncountedUnread.has(id);
		};

		/**
		 * Records that answer. It is deliberately outside the total: a dot cannot
		 * be added to a number, and the taskbar badge is a number.
		 *
		 * @param {*} id		Id of the service.
		 * @param {boolean} on	Whether it has something waiting.
		 */
		this.setSomethingUnreadForService = function(id, on) {
			on ? servicesWithUncountedUnread.add(id) : servicesWithUncountedUnread.delete(id);
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
