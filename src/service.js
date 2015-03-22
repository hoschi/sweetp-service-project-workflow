var sweetp = require('sweetp-base');
var log = require('sweetp-base/lib/log')('project-workflow:internal:');
var _ = require('lodash');
var async = require('async');

// get function to call a sweetp service
function  getCallService (sweetpServerUrl, projectName) {
	return _.partial(sweetp.callService, sweetpServerUrl, projectName);
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
function callServiceWithBranchName (sweetpServerUrl, projectName, branchName, serviceName, successMessage, callback) {
	var params, callService, callbackWithMessage;

	if (!branchName) {
		return callback("No name for branch");
	}

	params = {};
	params.name = branchName;
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

exports.saveBranchName = function (params, callback) {
	var branchName, response;

	if (!params.context.ticketId) {
		return callback("Can't work without ticket id, there is no `ticketId` property in given context!");
	}

	response = {};

	// don't override existing branch name, e.g. supplied by user
	if (params.context.branchName) {
		response.msg = "Nothing done, branch name already exists in context: '" + params.context.branchName + "'";
		response.context = params.context;
		return callback(undefined, response);
	}

	// create branch name by static string + ticket id
	branchName = 'feature/' + params.context.ticketId.toString();

	// apply it to context
	params.context.branchName = branchName;

	// save message
	response.msg = "Saved branch name '" + branchName + "' in context.";

	// save modified context
	response.context = params.context;

	callback(undefined, response);
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
		var response, message;
		if (err) {
			message = "Worked steps: ";
			if (stepMessages) {
				message += _.compact(stepMessages).join(', ');
			}
			err = message + ". Error: " + err;
			return callback(err);
		}

		response = {};
		response.msg = stepMessages.join(', ');
		response.context = params.context;
		callback(undefined, response);
	});
};
// add assertion
exports.createContextBranch = needsContextInParams(exports.createContextBranch);

exports.saveAncestor = function (sweetpServerUrl, projectName, context, callback) {
	var callService;

	callService = getCallService(sweetpServerUrl, projectName);
	callService("scm/branch/name", {}, false, function (err, branchName) {
		if (err) {
			return callback(err);
		}

		context.branchAncestor = branchName;

		callback(undefined, "Ancestor branch '" + branchName + "' saved in context");
	});
};

exports.createBranch = function (sweetpServerUrl, projectName, context, callback) {
	callServiceWithBranchName(sweetpServerUrl, projectName, context.branchName, "scm/branch/create", "Branch '" + context.branchName + "' created if not already existed", callback);
};

exports.checkoutBranch = function (sweetpServerUrl, projectName, context, callback) {
	callServiceWithBranchName(sweetpServerUrl, projectName, context.branchName, "scm/checkout", "Switched to branch '" + context.branchName + "'", callback);
};

exports.checkoutBranchAncestor = function (params, callback) {
	var branchName;

	if (!params.context.branchAncestor) {
		return callback("Can't work without ancestor branch name, there is no `branchAncestor` property in given context!");
	}
	branchName = params.context.branchAncestor;

	callServiceWithBranchName(params.url, params.config.name, branchName, "scm/checkout", "Switched to branch '" + branchName + "'", callback);
};
// add assertion
exports.checkoutBranchAncestor = needsContextInParams(exports.checkoutBranchAncestor);
