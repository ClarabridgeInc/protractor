'use strict';

var q = require('q');

var ChromeCapabilityBuilder = function() {

	this.build = function(runCapability, taskId) {
		var userAgent = runCapability.cxstudioOptions.userAgent;
		var downloadDirectory = runCapability.cxstudioOptions.downloadDirectory + '\\' + taskId;

		var deferred = q.defer();
		runCapability.chromeOptions = {
			prefs : {
				'download' : {
					'prompt_for_download' : false,
					'default_directory' : downloadDirectory
				}
			}
		}
		deferred.resolve(runCapability);
		
		return deferred.promise;
	};

};

module.exports = new ChromeCapabilityBuilder();