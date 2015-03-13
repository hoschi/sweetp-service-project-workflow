var sweetp = require("sweetp-base");
var service = require("./service");

exports.createContextBranch = {
	options: {
		route: {
			method: sweetp.ROUTER_METHODS.configExists,
			property: 'git'
		},
		params: {
			url: sweetp.PARAMETER_TYPES.url,
			config: sweetp.PARAMETER_TYPES.projectConfig,
			context: sweetp.PARAMETER_TYPES.one
		},
		description: {
			summary: "Create a new branch for a context and safe its ancestor."
		},
		returns: "string"
	},
	fn: service.createContextBranch
};

exports.saveBranchName = {
	options: {
		params: {
			url: sweetp.PARAMETER_TYPES.url,
			config: sweetp.PARAMETER_TYPES.projectConfig,
			context: sweetp.PARAMETER_TYPES.one
		},
		description: {
			summary: "Save branch name for context. This leads to 'feature/ID' where 'ID' is the `ticketId` property of the context."
		},
		returns: "string"
	},
	fn: service.saveBranchName
};

exports.checkoutBranchAncestor = {
	options: {
		params: {
			url: sweetp.PARAMETER_TYPES.url,
			config: sweetp.PARAMETER_TYPES.projectConfig,
			context: sweetp.PARAMETER_TYPES.one
		},
		description: {
			summary: "Checkout branch which is the ancestor of a context branch. This method performs a checkout of the branch name saved in the `branchAncestor` property of the context."
		},
		returns: "string"
	},
	fn: service.checkoutBranchAncestor
};

