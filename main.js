var sweetp = require("sweetp-base");
var service = require("./src/service-methods.js");
var methods, client;

methods = sweetp.createMethods(service, "/project-workflow/");
client = sweetp.start("project-workflow", methods);
