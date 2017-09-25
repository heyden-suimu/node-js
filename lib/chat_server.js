var socketio = require('socket.io'),
io,
guestNumber = 1,
nickNmaes = {},
namesUsed = [],
currentRoom = {};

exports.listen = function(server){
	io = socketio.listen(server);
	io.set('log level',1);

	io.sockets.on('connection',function(socket){
		guestNumber = assignGuestName(socket, guestNumber, nickNmaes, namesUsed);
		joinRoom(socket, 'Lobby');

		handleMessageBroadcasting(socket, nickNmaes);
		handleNameChangeAttempts(socket, nickNmaes, namesUsed);
		handleRoomJoining(socket);

		socket.on('room', function(){
			socket.emit('room', io.sockets.manager.rooms);
		});

		handleClientDisconnection(socket, nickNmaes, namesUsed);
	})
}

function assignGuestName(socket, guestNumber, nickNmaes, namesUsed){
	var name = 'Guest' + guestNumber;
	nickNmaes[socket.id] = name;
	socket.emit('nameResult', {
		success: true,
		name: name
	});
	namesUsed.push(name);
	return guestNumber + 1;
}

function joinRoom(socket, room){
	socket.join(room);
	currentRoom[socket.id] = room;
	socket.emit('joinResult', {room: room});
	socket.broadcast.to(room).emit('message',{
		text: nickNmaes[socket.id] + ' has joined ' + room +'.'
	});

	var usersInRoom = io.sockets.clients(room);
	if(usersInRoom.length > 1){
		var usersInRoomSummary = 'Users current in' + room + ':';
		for(var index in usersInRoom){
			var userSocketId = usersInRoom[index].id;
			if(userSocketId != socket.id){
				if(index > 0){
					usersInRoomSummary += ', ';
				}
				usersInRoomSummary += nickNmaes[userSocketId];
			}
		}
		usersInRoomSummary += ".";
		socket.emit('message', {text: usersInRoomSummary})
	}
}

function handleNameChangeAttempts(socket, nickNmaes ,namesUsed) {
	socket.on('nameAttempt', function(name){
		if (name.indexOf('Guest') == 0){
			socket.emit('nameResult',{
				success:false,
				message:'Names cannot begin with "Guest".'
			});
		} else {
			if (namesUsed.indexOf(name) == -1){
				var previousName = nickNmaes[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNmaes[socket.id] = name;
				delete namesUsed[previousNameIndex];
				socket.emit('nameResult', {
					success: true,
					name: name
				});
				socket.broadcast.to(currentRoom[socket.id]).emit('message',{
					text: previousName + ' is now known as ' + name + '.'
				});
			}else{
				socket.emit('nameResult', {
					success: false,
					message: 'That name is already in use.'
				})
			}
		}
	})
}

function handleMessageBroadcasting(socket){
	socket.on('message', function(message){
		socket.broadcast.to(message.room).emit('message', {
			text: nickNmaes[socket.id] +': ' + message.text
		});
	});
}

function handleRoomJoining(socket){
	socket.on('join', function(room){
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	})
}

function handleClientDisconnection(socket){
	socket.on('disconnect', function(){
		var nameIndex = namesUsed.indexOf(nickNmaes[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNmaes[socket.id];
	})
}

