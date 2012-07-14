var net = require("net"),
	xml2js = require("xml2js"),
	events = require("events"),
	sys = require("sys"),
	buffertools = require("buffertools");

var PORT = 5950;
	
var parser = new xml2js.Parser({explicitArray: true, mergeAttrs: true});

parser.saxParser.strict = false;

function formatShortcut(shortcut){
	return '<shortcut name="' + shortcut.name + '" value="' + shortcut.value + '" />';
}

function formatShortcutArray(shortcuts){
	var str = "<shortcuts>";
	for(var i = 0; i < shortcuts.length; i++){
		str += formatShortcut(shortcuts[i]);
	}
	// BAD XML. INORITE?
	str += "<shortcuts />";
	return str;
}

var exports = function(TC_IP, THIS_IP, cb){
	var self = this;
	this.shortcuts = new events.EventEmitter();
	var server = net.createServer(function(c){
		c.on("data", function(newData){
			self.buffer = self.buffer.concat(newData);
			var parsed;
			while(parsed = self.parsePacket()){
				parser.parseString(parsed.data, function(err, data){
					if(err){
						self.emit("error", err);
					}else{
						self.emit("message", data);
						if(data.shortcut_state){
							for(var i = 0; i < data.shortcut_state.length; i++){
								self.emit("shortcut", data.shortcut_state[i]);
								self.shortcuts.emit(data.shortcut_state[i].name, data.shortcut_state[i].value);
							}
						}
					}
				});
				self.emit("raw", parsed);
			}
		});
		c.on('end', function(){
			console.error("Server Disconnected");
		});
	});
	server.listen(PORT, function(){
		self.client = net.connect(PORT, TC_IP, function(){
			server.listen(PORT, function(){
				self.send("UI|shortcuts:response", '<new_tricaster_fc3_client name="\\\\' + THIS_IP + '\\mailbox" />');
				if(cb){
					cb();
				}
			});
		});
		self.client.on("error", console.log);
	});
	
	this.server = server;
	return this;
}

sys.inherits(exports, events.EventEmitter);

var tc = {
	buffer: new Buffer(0),
	parsePacket: function(){
		try{
			var data = this.buffer;
			var obj = {};
			var destSize = data.readUInt32LE(8);
			var payloadSize = data.readUInt32LE(12);
			obj.dest = data.toString("utf16le", 16, 14 + destSize);
			obj.data = data.toString("utf16le", 16 + destSize + 48, 16 + destSize + payloadSize - 2);
			this.buffer = data.slice(16 + destSize + payloadSize);
			return obj;
		}catch(e){
			return false;
		}
	},
	buildPacket: function(dest, msg){
		// Calculate the packet content length
		var destLength = (dest.length + 1) * 2;
		var msgLength = (msg.length + 1) * 2;
		var length = 16 + destLength + 48 + msgLength;
		var out = new Buffer(length);
		out.fill(0, 0, length);
		// Write the header:
		// Version 1
		out.writeUInt32LE(0x1, 0);
		// Dest length
		out.writeUInt32LE(destLength, 8);
		// Data length
		out.writeUInt32LE(48 + msgLength, 12);
		// End header
		// Write dest in wide characters (UTF-16)
		out.write(dest + "\0", "utf16le", 16, destLength);
		// Type 2
		out.writeUInt32LE(0x2, 16 + destLength);
		// Msg length
		out.writeUInt32LE(msgLength, 20 + destLength);
		// Ignore 40 unused bytes
		// Write msg in wide characters (UTF-16)
		out.write(msg + "\0", "utf16le", 16 + destLength + 48, msgLength);
		return out;
	},
	sendRaw: function(rawData){
		this.client.write(rawData);
	},
	send: function(dest, msg){
		this.sendRaw(this.buildPacket(dest, msg));
	},
	sendShortcut: function(name, value){
		this.send("UI|shortcuts:response", formatShortcutArray([{name: name, value: value}]));
	},
	sendShortcutArray: function(arr){
		this.send("UI|shortcuts:response", formatShortcutArray(arr));
	}
};

for(var i in tc){
	exports.prototype[i] = tc[i];
}

module.exports = exports;