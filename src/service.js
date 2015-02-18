var sweetp = require('sweetp-base');
var _ = require('lodash');
var async = require('async');
var debug = require('debug');
var log = {};
['debug', 'error', 'log', 'warn', 'info'].forEach(function (level) {
	log[level] = debug('project-workflow:internal:' + level);
});

function  getCallService (sweetpServerUrl, projectName) {
	return _.partial(sweetp.callService, sweetpServerUrl, projectName);
}

function createSuccessCallbackForMessage (callback, message) {
	// use only provided error, use fixed message as success value
	return function (err) {
		if (err) {
			return callback(err);
		}

		callback(undefined, message);
	};
}

function callServiceWithBranchName (branchName, params, callService, callback) {
	if (!branchName) {
		return callback("No name for branch");
	}
	params.name = branchName;
	params.force = false;

	callService(params, false, callback);
}

exports.createContextBranch = function (params, callback) {
	var projectName, context, sweetpServerUrl, steps;

	log.debug("Supplied context:", params.context);
	if (!params.context) {
		return callback("Can't work without context!");
	}

	context = JSON.parse(params.context);

	projectName = params.config.name;
	sweetpServerUrl = params.url;

	steps = [];

	if (!context.branchAncestor) {
		// save ancestor, not already in context
		steps.push(_.partial(exports.saveAncestor, sweetpServerUrl, projectName, context));
	}

	steps.push(_.partial(exports.createBranch, sweetpServerUrl, projectName, context));
	steps.push(_.partial(exports.checkoutBranch, sweetpServerUrl, projectName, context));

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

exports.saveAncestor = function (sweetpServerUrl, projectName, context, callback) {
	var callService;

	callService = getCallService(sweetpServerUrl, projectName);
	callService("scm/branch/name", {}, false, function (err, branchName) {
		var params;

		if (err) {
			return callback(err);
		}

		params = {
			id: context._id,
			properties: JSON.stringify({
				branchAncestor: branchName
			})
		};

		callService("project-context/patchContext", params, false, createSuccessCallbackForMessage(callback, "Ancestor branch '" + branchName + "' saved in context"));
	});
};

exports.createBranch = function (sweetpServerUrl, projectName, context, callback) {
	var callService, callbackWithMessage;

	callService = getCallService(sweetpServerUrl, projectName);
	callService = _.partial(callService, "scm/branch/create");
	callbackWithMessage = createSuccessCallbackForMessage(callback, "Branch '" + context.branchName + "' created if not already existed");

	callServiceWithBranchName(context.branchName, {}, callService, callbackWithMessage);
};

exports.checkoutBranch = function (sweetpServerUrl, projectName, context, callback) {
	var callService, callbackWithMessage;

	callService = getCallService(sweetpServerUrl, projectName);
	callService = _.partial(callService, "scm/checkout");
	callbackWithMessage = createSuccessCallbackForMessage(callback, "Switched to branch '" + context.branchName + "'");

	callServiceWithBranchName(context.branchName, {}, callService, callbackWithMessage);
};

