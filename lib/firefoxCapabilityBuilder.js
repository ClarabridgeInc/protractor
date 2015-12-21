'use strict';

var q = require('q');
var FirefoxProfile = require('firefox-profile');

var FirefoxCapabilityBuilder = function() {

	this.build = function(runCapability, taskId) {
		var userAgent = runCapability.cxstudioOptions.userAgent;
		var downloadDirectory = runCapability.cxstudioOptions.downloadDirectory + '\\' + taskId;

		var deferred = q.defer();
		var firefoxProfile = new FirefoxProfile();
		firefoxProfile.setPreference('browser.download.dir', downloadDirectory);
		firefoxProfile.setPreference('browser.download.folderList', 2);
		firefoxProfile.setPreference('browser.download.manager.showWhenStarting', false);
		firefoxProfile.setPreference("browser.download.defaultFolder", downloadDirectory);
		firefoxProfile.setPreference("browser.helperApps.alwaysAsk.force", false);
		firefoxProfile.setPreference("browser.helperApps.neverAsk.saveToDisk", "application/octet-stream");
		firefoxProfile.encoded(function(encodedProfile) {
			runCapability.firefox_profile = encodedProfile;
			deferred.resolve(runCapability);
		});
		
		return deferred.promise;
	};

};

module.exports = new FirefoxCapabilityBuilder();