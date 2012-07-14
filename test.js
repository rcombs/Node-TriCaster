#! /usr/bin/env node
var tricaster = require("./index.js");
var readline = require("readline");
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.setPrompt("> ");

var TC = new tricaster(process.argv[2], process.argv[3], function(){
	console.log("Running...");
	rl.prompt();
});

rl.on("line", function(line){
	var split = line.split(" ");
	var name = split.shift();
	var value = split.join(" ");
	TC.sendShortcut(name, value);
	rl.prompt();
});

TC.on("shortcut", function(data){
	console.log(data.name + ": " + data.value);
	rl.prompt();
});