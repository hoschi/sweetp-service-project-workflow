var sweetp = require('sweetp-base');
var log = require('sweetp-base/lib/log')('project-workflow:internal:');
var _ = require('lodash');
var async = require('async');

// get function to call a sweetp service
function  getCallService (sweetpServerUrl, projectName) {
	return _.partial(sweetp.callService, sweetpServerUrl, projectName);
}

// get function to call a sweetp service, use params to get url and project name
function getCallServiceFromParams (params) {
	return getCallService(params.url, params.config.name);
}

// create callback with fixed success message
function createSuccessCallbackForMessage (callback, message) {
	// use only provided error, use fixed message as success value
	return function (err) {
		if (err) {
			return callback(err);
		}

		callback(undefined, message);
	};
}

// call service with branch name already defined
function callServiceWithBranchName (sweetpServerUrl, projectName, context, serviceName, successMessage, callback) {
	var params, callService, callbackWithMessage;

	if (!context.branchName) {
		return callback("No name for branch");
	}

	params = {};
	params.name = context.branchName;
	params.force = false;

	callService = getCallService(sweetpServerUrl, projectName);
	callbackWithMessage = createSuccessCallbackForMessage(callback, successMessage);

	callService(serviceName, params, false, callbackWithMessage);
}

// assert for `context` property in params and convert it to JSON
function needsContextInParams (wrappedFunction) {
	return function (params, callback) {
		log.debug("Supplied context:", params.context);
		if (!params.context) {
			return callback("Can't work without context!");
		}

		params.context = JSON.parse(params.context);
		wrappedFunction(params, callback);
	};
}

// patch context with supplied properties
function patchContext (callService, contextId, properties, callback) {
	var patchContextParams;

	patchContextParams = {
		id: contextId,
		properties: JSON.stringify(properties)
	};
	callService("project-context/patchContext", patchContextParams, false, callback);
}

exports.saveBranchName = function (params, callback) {
	var callService, branchName, patchedContextProperties;

	if (!params.context.ticketId) {
		return callback("Can't work without ticket id, there is no `ticketId` property in given context!");
	}

	// don't override existing branch name, e.g. supplied by user
	if (params.context.branchName) {
		return callback(undefined, "Nothing done, branch name already exists in context: '" + params.context.branchName + "'");
	}

	// create branch name by static string + ticket id
	branchName = 'feature/' + params.context.ticketId.toString();
	patchedContextProperties = {
		branchName: branchName
	};
	callService = getCallServiceFromParams(params);
	// patch context with this new information
	patchContext(callService, params.context._id, patchedContextProperties, createSuccessCallbackForMessage(callback, "Saved branch name '" + branchName + "' in context."));
};
// add assertion
exports.saveBranchName = needsContextInParams(exports.saveBranchName);

exports.createContextBranch = function (params, callback) {
	var projectName, sweetpServerUrl, steps;

	projectName = params.config.name;
	sweetpServerUrl = params.url;

	steps = [];

	if (!params.context.branchAncestor) {
		// save ancestor, not already in context
		steps.push(_.partial(exports.saveAncestor, sweetpServerUrl, projectName, params.context));
	}

	steps.push(_.partial(exports.createBranch, sweetpServerUrl, projectName, params.context));
	steps.push(_.partial(exports.checkoutBranch, sweetpServerUrl, projectName, params.context));

	async.series(steps, function (err, stepMessages) {
		var message;
		if (err) {
			message = "Worked steps: ";
			if (stepMessages) {
				message += _.compact(stepMessages).join(', ');
			}
			err = message + ". Error: " + err;
			return callback(err);
		}

		message = stepMessages.join(', ');
		callback(undefined, message);
	});
};
// add assertion
exports.createContextBranch = needsContextInParams(exports.createContextBranch);

exports.saveAncestor = function (sweetpServerUrl, projectName, context, callback) {
	var callService;

	callService = getCallService(sweetpServerUrl, projectName);
	callService("scm/branch/name", {}, false, function (err, branchName) {
		var patchedContextProperties;

		if (err) {
			return callback(err);
		}

		patchedContextProperties = {
			branchAncestor: branchName
		};

		patchContext(callService, context._id, patchedContextProperties, createSuccessCallbackForMessage(callback, "Ancestor branch '" + branchName + "' saved in context"));
	});
};

exports.createBranch = function (sweetpServerUrl, projectName, context, callback) {
	callServiceWithBranchName(sweetpServerUrl, projectName, context, "scm/branch/create", "Branch '" + context.branchName + "' created if not already existed", callback);
};

exports.checkoutBranch = function (sweetpServerUrl, projectName, context, callback) {
	callServiceWithBranchName(sweetpServerUrl, projectName, context, "scm/checkout", "Switched to branch '" + context.branchName + "'", callback);
};

