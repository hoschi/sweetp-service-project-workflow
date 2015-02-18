var should = require('chai').should();
var _ = require('lodash');
var nock = require('nock');
var sinon = require('sinon');
var querystring = require('querystring');

var s = require('../src/service');

var baseParams;

baseParams = {
	url: 'http://localhost:1234/',
	config: {
		name: 'test'
	}
};

function mockSweetpServiceCall (params, serviceName, serviceParams, fail) {
	var serviceQuery, call;

	serviceQuery = "";

	if (serviceParams) {
		serviceQuery = "?" + querystring.stringify(serviceParams);
	}

	call = nock(params.url)
		.get('/services/' + params.config.name + '/' + serviceName + serviceQuery);

	if (fail) {
		call.reply(500);
	} else {
		call.reply(200, {
			service: serviceName + " reply"
		});
	}
}

describe('Method to create branch for context', function () {
	var params;
	params = _.cloneDeep(baseParams);

	it('should fail without branch name.', function (done) {
		s.createBranch(params.url, params.config.name, {}, function (err) {
			err.should.equal("No name for branch");
			done();
		});
	});

	it('should fail with service call error.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';
		mockSweetpServiceCall(params, 'scm/branch/create', {
			name: branchName,
			force: false
		}, true);

		s.createBranch(params.url, params.config.name, {
			branchName: branchName
		}, function (err) {
				err.message.should.contain("during call to service");
				err.message.should.contain("scm/branch/create");
				done();
			});
	});

	it('should return info message when all went fine.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';
		mockSweetpServiceCall(params, 'scm/branch/create', {
			name: branchName,
			force: false
		});

		s.createBranch(params.url, params.config.name, {
			branchName: branchName
		}, function (err, message) {
				should.not.exist(err);
				message.should.contain(branchName);
				message.should.match(/created if not already existed/);
				done();
			});
	});

});

describe('Method to checkout branch for context', function () {
	var params;
	params = _.cloneDeep(baseParams);

	it('should fail without branch name.', function (done) {
		s.checkoutBranch(params.url, params.config.name, {}, function (err) {
			err.should.equal("No name for branch");
			done();
		});
	});

	it('should fail with service call error.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';
		mockSweetpServiceCall(params, 'scm/checkout', {
			name: branchName,
			force: false
		}, true);

		s.checkoutBranch(params.url, params.config.name, {
			branchName: branchName
		}, function (err) {
				err.message.should.contain("during call to service");
				err.message.should.contain("scm/checkout");
				done();
			});
	});

	it('should return info message when all went fine.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';
		mockSweetpServiceCall(params, 'scm/checkout', {
			name: branchName,
			force: false
		});

		s.checkoutBranch(params.url, params.config.name, {
			branchName: branchName
		}, function (err, message) {
				should.not.exist(err);
				message.should.contain(branchName);
				message.should.match(/^Switched to branch/);
				done();
			});
	});

});

describe('Method to save ancestor branch name in context', function () {
	var params;
	params = _.cloneDeep(baseParams);

	it('should fail with service call error, when try to get current branch name.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';

		// fake current branch name
		nock(params.url)
			.get('/services/' + params.config.name + '/scm/branch/name')
			.reply(500);

		s.saveAncestor(params.url, params.config.name, {
			_id: "contextId",
		}, function (err) {
				err.message.should.contain("during call to service");
				err.message.should.contain("scm/branch/name");
				done();
			});
	});

	it('should fail with service call error, when try to patch context.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';

		// fake current branch name
		nock(params.url)
			.get('/services/' + params.config.name + '/scm/branch/name')
			.reply(200, {
				service: branchName
			});

		mockSweetpServiceCall(params, 'project-context/patchContext', {
			id: "contextId",
			properties: JSON.stringify({
				branchAncestor: branchName
			})
		}, true);

		s.saveAncestor(params.url, params.config.name, {
			_id: "contextId",
		}, function (err) {
				err.message.should.contain("during call to service");
				err.message.should.contain("patchContext");
				done();
			});
	});

	it('should return info message when all went fine.', function (done) {
		var branchName;

		branchName = 'feature/myTest24';

		// fake current branch name
		nock(params.url)
			.get('/services/' + params.config.name + '/scm/branch/name')
			.reply(200, {
				service: branchName
			});

		mockSweetpServiceCall(params, 'project-context/patchContext', {
			id: "contextId",
			properties: JSON.stringify({
				branchAncestor: branchName
			})
		});

		s.saveAncestor(params.url, params.config.name, {
			_id: "contextId",
		}, function (err, message) {
				should.not.exist(err);
				message.should.contain(branchName);
				message.should.match(/Ancestor .* saved/);
				done();
			});
	});

});

describe('Method to create a branch for a given context', function () {
	var params;
	params = _.cloneDeep(baseParams);

	it('should fail without context.', function (done) {
		s.createContextBranch(params, function (err) {
			err.should.equal("Can't work without context!");
			done();
		});
	});

	it('should fail when one step fails.', function (done) {
		var ms, context;

		context = {
			id: 'foo'
		};

		ms = sinon.mock(s);
		ms.expects("saveAncestor")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Saved ancestor");

		ms.expects("createBranch")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, "Error when creating branch.");

		ms.expects("checkoutBranch").never();

		params.context = JSON.stringify(context);
		s.createContextBranch(params, function (err) {
			err.should.equal("Worked steps: Saved ancestor. Error: Error when creating branch.");
			ms.verify();
			done();
		});
	});

	it('should save current branch as ancestor, create a branch for the context and check it out.', function (done) {
		var ms, context;

		context = {
			id: 'foo'
		};

		ms = sinon.mock(s);
		ms.expects("saveAncestor")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Saved ancestor");

		ms.expects("createBranch")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Branch created");

		ms.expects("checkoutBranch")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Branch switched");

		params.context = JSON.stringify(context);
		s.createContextBranch(params, function (err, message) {
			should.not.exist(err);
			message.should.equal("Saved ancestor, Branch created, Branch switched");
			ms.verify();
			done();
		});
	});

	it('should create a branch for the context and check it out, when ancestor already saved in context.', function (done) {
		var mock, context;

		context = {
			id: 'foo',
			branchAncestor: 'ancestorBranch'
		};

		mock = sinon.mock(s);

		mock.expects("saveAncestor").never();

		mock.expects("createBranch")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Branch created");

		mock.expects("checkoutBranch")
			.withArgs(params.url, params.config.name, context)
			.callsArgWith(3, undefined, "Branch switched");

		params.context = JSON.stringify(context);
		s.createContextBranch(params, function (err, message) {
			should.not.exist(err);
			message.should.equal("Branch created, Branch switched");
			mock.verify();
			done();
		});
	});

});

