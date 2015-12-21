/**
 * The taskScheduler keeps track of the spec files that needs to run next
 * and which task is running what.
 */
'use strict';

var q = require('q');

var ConfigParser = require('./configParser');
var chromeCapabilityBuilder = require('./chromeCapabilityBuilder');
var firefoxCapabilityBuilder = require('./firefoxCapabilityBuilder');

var capabilityBuilders = {
	chrome : chromeCapabilityBuilder,
	firefox : firefoxCapabilityBuilder
};

// A queue of specs for a particular capacity
var TaskQueue = function(capabilities, specLists) {
  this.capabilities = capabilities;
  this.numRunningInstances = 0;
  this.maxInstance = capabilities.maxInstances || 1;
  this.specsIndex = 0;
  this.specLists = specLists;
};

/**
 * A scheduler to keep track of specs that need running and their associated
 * capabilities. It will suggest a task (combination of capabilities and spec)
 * to run while observing the following config rules:
 * multiCapabilities, shardTestFiles, and maxInstance.
 * Precondition: multiCapabilities is a non-empty array
 * (capabilities and getCapabilities will both be ignored)
 *
 * @constructor
 * @param {Object} config parsed from the config file
 */
var TaskScheduler = function(config) {
  var excludes = ConfigParser.resolveFilePatterns(config.exclude, true, config.configDir);
  var allSpecs = ConfigParser.resolveFilePatterns(
      ConfigParser.getSpecs(config), false, config.configDir).filter(function(path) {
        return excludes.indexOf(path) < 0;
      });

  var taskQueues = [];
  config.multiCapabilities.forEach(function(capabilities) {
    var capabilitiesSpecs = allSpecs;
    if (capabilities.specs) {
      var capabilitiesSpecificSpecs = ConfigParser.resolveFilePatterns(
          capabilities.specs, false, config.configDir);
      capabilitiesSpecs = capabilitiesSpecs.concat(capabilitiesSpecificSpecs);
    }

    if (capabilities.exclude) {
      var capabilitiesSpecExcludes = ConfigParser.resolveFilePatterns(
          capabilities.exclude, true, config.configDir);
      capabilitiesSpecs = ConfigParser.resolveFilePatterns(
          capabilitiesSpecs).filter(function(path) {
              return capabilitiesSpecExcludes.indexOf(path) < 0;
          });
    }

    var specLists = [];
    // If we shard, we return an array of one element arrays, each containing
    // the spec file. If we don't shard, we return an one element array
    // containing an array of all the spec files
    if (capabilities.shardTestFiles) {
      capabilitiesSpecs.forEach(function(spec) {
        specLists.push([spec]);
      });
    } else {
      specLists.push(capabilitiesSpecs);
    }

    capabilities.count = capabilities.count || 1;

    for (var i = 0; i < capabilities.count; ++i) {
      taskQueues.push(new TaskQueue(capabilities, specLists));
    }
  });
  this.taskQueues = taskQueues;
  this.config = config;
  this.rotationIndex = 0; // Helps suggestions to rotate amongst capabilities
};

/**
 * Get the next task that is allowed to run without going over maxInstance.
 *
 * @return {{capabilities: Object, specs: Array.<string>, taskId: string, done: function()}}
 */
TaskScheduler.prototype.nextTask = function() {
  for (var i = 0; i < this.taskQueues.length; ++i) {
    var rotatedIndex = ((i + this.rotationIndex) % this.taskQueues.length);
    var queue = this.taskQueues[rotatedIndex];
    if (queue.numRunningInstances < queue.maxInstance &&
        queue.specsIndex < queue.specLists.length) {
      this.rotationIndex = rotatedIndex + 1;
      ++queue.numRunningInstances;
      var taskId = rotatedIndex + 1;
      if (queue.specLists.length > 1) {
    	//ascii 97 is 'a'     
    	var tempIndex = queue.specsIndex;
    	var stringIndex = '';
    	do {
    		stringIndex = String.fromCharCode(97 + tempIndex % 26) + stringIndex;
    		tempIndex = Math.floor(tempIndex / 26);  		
    	} while (tempIndex != 0);
    	  
        taskId += stringIndex;
      }
      var specs = queue.specLists[queue.specsIndex];
      ++queue.specsIndex;

      var runCapability = JSON.parse(JSON.stringify(queue.capabilities)); 
	  
	  var result = {
		capabilities: runCapability,
		specs: specs,
		taskId: taskId,
		done: function() {
		  --queue.numRunningInstances;
		}

	  };
	  	
	  	var resultDefer = q.defer();
	  	var capabilityBuilder = capabilityBuilders[runCapability.browserName];
	  	if (capabilityBuilder) {
			capabilityBuilder.build(runCapability, taskId)
				.then(function(capability) {
					console.log('--- Protractor modified capability ---');
					console.log(capability);
					resultDefer.resolve(result);
				});
	  	} else {
	  		console.log('--- Protractor modified capability ---');
			console.log(runCapability);
	  		resultDefer.resolve(result);
	  	}
		return resultDefer.promise;
	}
  }

  return null;
};

/**
 * Get the number of tasks left to run or are currently running.
 *
 * @return {number}
 */
TaskScheduler.prototype.numTasksOutstanding = function() {
  var count = 0;
  this.taskQueues.forEach(function(queue) {
    count += queue.numRunningInstances + (queue.specLists.length - queue.specsIndex);
  });
  return count;
};

/**
 * Get maximum number of concurrent tasks required/permitted.
 *
 * @return {number}
 */
TaskScheduler.prototype.maxConcurrentTasks = function() {
  if (this.config.maxSessions && this.config.maxSessions > 0) {
    return this.config.maxSessions;
  } else {
    var count = 0;
    this.taskQueues.forEach(function(queue) {
      count += Math.min(queue.maxInstance, queue.specLists.length);
    });
    return count;
  }
};

/**
 * Returns number of tasks currently running.
 *
 * @return {number}
 */
TaskScheduler.prototype.countActiveTasks = function() {
  var count = 0;
  this.taskQueues.forEach(function(queue) {
    count += queue.numRunningInstances;
  });
  return count;
};

module.exports = TaskScheduler;
