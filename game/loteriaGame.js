// @ts-nocheck
var _ = require("lodash");
var Utility = require("../models/utility");
var gameCard = require("../game/gameCard");
const winPattern = require("../game/wincron.json");
function nullMatrix(number) {
	let matrix__cell = Array(number)
		.fill(0)
		.map(function () {
			return Array(number)
				.fill(0)
				.map(function () {
					return {
						state: 0,
						card: 0,
					};
				});
		});
	return matrix__cell;
}
Array.prototype.remove = function (from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};
var gameList = new Object();
exports.initGame = function (sio, socket) {
	var utility = new Utility(sio, socket);
	const getGameURL = socket.handshake.headers.referer?.split("/games/");
	if (getGameURL?.length > 1) {
		const slugURL = getGameURL[1]?.split("/");
		if (slugURL[0]) {
			utility.setGameCards(slugURL[0]);
		}
	}
	// on create new game
	socket.on("createNewGame", (hostData, gameType) => {
		utility.setGameType(gameType);
		// classroom
		if (utility.isClassroom()) {
			utility.setHost(socket.id);
			utility.setWinCon(hostData["winCon"]);
			utility.setPlayerLimit(6);
			let gameID = utility.getGameID();
			hostData["gameId"] = gameID;
			hostData["winCon"] = utility.getWinCon();
			hostData["url"] = hostData["url"].replace("/host", `/player/${gameID}`);
			hostData["gameName"] = utility.getGameName();
			hostData["gameSlug"] = utility.getGameSlug();
			hostData["duration"] = utility.getDuration();
			hostData["gameStyle"] = utility.getGameStyle(); // 3 = 3X3; 4 = 4X4
			utility.onGameCreatedWithURL(hostData["url"], hostData, socket, sio);
			gameList[gameID] = utility.createObject();
			// console.log(gameList[gameID])
		}
		// single player
		if (utility.isSingle()) {
			utility.setHost(socket.id);
			utility.setPlayerLimit(1);
			let gameID = utility.getGameID();
			hostData["gameId"] = gameID;
			hostData["winCon"] = utility.getWinCon();
			hostData["gameName"] = utility.getGameName();
			hostData["gameSlug"] = utility.getGameSlug();
			hostData["duration"] = utility.getDuration();
			hostData["gameStyle"] = utility.getGameStyle(); // 3 = 3X3; 4 = 4X4
			var player = {
				id: socket.id,
				name: hostData?.playerName || "Anonymous",
				status: false,
				role: "player",
				card: nullMatrix(hostData["gameStyle"]),
				score: 0,
				gameOver: false,
			};
			utility.addPlayer(player);
			gameList[gameID] = utility.createObject();
			socket.join(gameID.toString());
			sio
				.to(socket.id)
				.emit("joinedGame", { winCron: hostData["winCon"], gameId: gameID });
		}
		// multiple game
		if (utility.isMultiple()) {
			utility.setHost(socket.id);
			utility.setPlayerLimit(5);
			let gameID = utility.getGameID();
			hostData["gameId"] = gameID;
			hostData["winCon"] = utility.getWinCon();
			hostData["url"] = `${hostData["url"]}/${gameID}`;
			hostData["gameName"] = utility.getGameName();
			hostData["gameSlug"] = utility.getGameSlug();
			hostData["duration"] = utility.getDuration();
			hostData["gameStyle"] = utility.getGameStyle(); // 3 = 3X3; 4 = 4X4
			var player = {
				id: socket.id,
				name: hostData?.playerName || "Anonymous",
				status: false,
				role: "player",
				card: nullMatrix(hostData["gameStyle"]),
				score: 0,
				gameOver: false,
			};
			utility.addPlayer(player);
			utility.onGameCreatedWithURL(hostData["url"], hostData, socket, sio);
			gameList[gameID] = utility.createObject();
		}
	});
	// on player join game
	socket.on("onPlayerJoinGame", (playerData, gameType) => {
		utility.setGameType(gameType);
		const room = socket.adapter.rooms.has(playerData?.gameId.toString());
		if (room) {
			const game = gameList[playerData?.gameId];
			if (typeof game != undefined) {
				if (!game.started) {
					if (game.players.length <= game.playerLimit) {
						var player = {
							id: socket.id,
							name: playerData?.playerName || "Anonymous",
							status: false,
							role: "player",
							card: nullMatrix(game.gameStyle),
							score: 0,
							gameOver: false,
						};
						game.players.push(player);
						socket.join(playerData.gameId);
						if (game.gameType === "multiple") {
							sio.sockets.in(playerData.gameId).emit("playerJoined", {
								winCron: game?.winCron,
								players: game.players,
							});
						} else {
							sio.to(socket.id).emit("joinedGame", { winCron: game?.winCron });
							sio.sockets.in(playerData.gameId).emit("playerJoined", player);
						}
					} else {
						sio.to(socket.id).emit("error", {
							message: "Full Room. Create new game",
							newGame: true,
						});
					}
				} else {
					sio
						.to(socket.id)
						.emit("error", { message: "Game has been started", newGame: true });
				}
			} else {
				sio
					.to(socket.id)
					.emit("error", { message: "Game Object is undefined" });
			}
		} else {
			sio.to(socket.id).emit("error", { message: "This room does not exist." });
		}
	});
	// on preloader
	socket.on("preLoader", (roomID) => {
		const room = socket.adapter.rooms.has(roomID.toString());
		if (room) {
			sio.sockets.in(roomID).emit("loadingAssets");
		}
	});
	// game start
	socket.on("gameStart", (data) => {
		const room = socket.adapter.rooms.has(data?.roomId.toString());
		if (room) {
			const game = gameList[data?.roomId];
			if (data?.role != "Teacher") {
				let currentPlayer = _.find(game.players, { id: data?.mySocketId });
				if (typeof currentPlayer != undefined) {
					currentPlayer.status = true;
					let checkStatus = game.players.every((obj) => obj?.status === true);
					if (checkStatus) {
						game.started = true;
						const gameData = {
							gameStarted: game.started,
							shuffleCards: game.shuffleCard,
						};
						sio.sockets.in(data?.roomId).emit("gameHasBeenStarted", gameData);
					}
				} else {
					sio
						.to(socket.id)
						.emit("error", { message: "currentPlayer is undefined" });
				}
			}
		}
	});
	// playerCard
	socket.on("playerCard", (gameId, playerId, martixCard) => {
		const room = socket.adapter.rooms.has(gameId.toString());
		if (room) {
			const game = gameList[gameId];
			let currentPlayer = _.find(game.players, { id: playerId });
			if (typeof currentPlayer != undefined) {
				currentPlayer.card = martixCard;
				sio.sockets
					.in(gameId)
					.emit("oppenentCards", playerId, currentPlayer.card);
			} else {
				sio
					.to(socket.id)
					.emit("error", { message: "currentPlayer is undefined" });
			}
		}
	});
	// startShuffle
	socket.on("startShuffle", (roomID) => {
		const room = socket.adapter.rooms.has(roomID.toString());
		if (room) {
			sio.sockets.in(roomID).emit("shuffleStarted");
		}
	});
	// teacher onDrawCard
	socket.on("current card", (currentCardId, roomID) => {
		const room = socket.adapter.rooms.has(roomID.toString());
		if (room) {
			sio.sockets.in(roomID).emit("currentCard", currentCardId);
		}
	});
	// teacher next draw
	socket.on("nextCard", (roomID) => {
		const room = socket.adapter.rooms.has(roomID.toString());
		if (room) {
			sio.sockets.in(roomID).emit("nextMove");
		}
	});
	// opponent updateActivity
	socket.on("updateActivity", (data, status) => {
		const room = socket.adapter.rooms.has(data?.roomId.toString());
		if (room) {
			const game = gameList[data?.roomId];
			let currentPlayer = _.find(game.players, { id: data?.userId });
			if (typeof currentPlayer != undefined) {
				currentPlayer.card[data?.x][data?.y].state = status;
				sio.sockets.in(data?.roomId).emit("oppStatus", {
					userId: data?.userId,
					row: data?.x,
					cell: data?.y,
				});
			} else {
				sio
					.to(socket.id)
					.emit("error", { message: "currentPlayer is undefined" });
			}
		}
	});
	// GameOver
	socket.on("GameOver", (roomId) => {
		let room = socket.adapter.rooms.has(roomId.toString());
		if (room) {
			const game = gameList[roomId];
			sio.sockets.in(roomId).emit("check winner");
		}
	});
	// loteriaFirst
	socket.on("loteriaFirst", (data) => {
		const room = socket.adapter.rooms.has(data?.roomId.toString());
		if (room) {
			const game = gameList[data?.roomId];
			let currentPlayer = _.find(game.players, { id: data?.userId });
			if (typeof currentPlayer != undefined) {
				if (data?.win) {
					currentPlayer.score = currentPlayer.score + 1;
				} else {
					currentPlayer.score = currentPlayer.score + 0;
				}
				currentPlayer.gameOver = true;
				sio.sockets.in(data?.roomId).emit("GameOver");
			} else {
				sio
					.to(socket.id)
					.emit("error", { message: "currentPlayer is undefined" });
			}

			if (
				game.players.length < 2 &&
				(game?.gameType === "classroom" || game.gameType === "single")
			) {
				sio.sockets.in(data?.roomId).emit("result", game.players);
			}
		}
	});
	// checkWinner
	socket.on("checkWinner", (data) => {
		const room = socket.adapter.rooms.has(data?.roomId.toString());
		if (room) {
			const game = gameList[data?.roomId];
			let currentPlayer = _.find(game.players, { id: data?.userId });
			if (typeof currentPlayer != undefined) {
				if (!currentPlayer.gameOver) {
					if (data?.win) {
						currentPlayer.score = currentPlayer.score + 1;
					} else {
						currentPlayer.score = currentPlayer.score + 0;
					}
					currentPlayer.gameOver = true;
				}
				let isGameEnd = game.players.every((obj) => obj.gameOver == true);
				if (isGameEnd) {
					sio.sockets.in(data?.roomId).emit("result", game.players);
				}
			} else {
				sio
					.to(socket.id)
					.emit("error", { message: "currentPlayer is undefined" });
			}
		}
	});
	// new game
	socket.on("newGame", (roomId) => {
		const room = socket.adapter.rooms.has(roomId.toString());
		if (room) {
			sio.sockets.in(roomId).emit("new Game");
			sio.in(roomId).socketsLeave(roomId);
			delete gameList[roomId];
		}
	});
	// restart game with lobby
	socket.on("restartGame", (roomID) => {
		const room = socket.adapter.rooms.has(roomID.toString());
		if (room) {
			const game = gameList[roomID];
			game.players.every((obj) => (obj.gameOver = false));
			game.players.every((obj) => (obj.status = false));
			sio.sockets.in(roomID).emit("waiting lobby");
		}
	});
	// new game with lobby
	socket.on("newGameWithSameLobby", async (gameData) => {
		const room = socket.adapter.rooms.has(gameData?.gameId.toString());
		if (room) {
			const game = gameList[gameData?.gameId];
			// console.log(game);
			game.gameSlug = gameData?.gameSlug;
			game.winCron = winPattern.filter(
				(item) => item.value === gameData?.winCron
			)[0];
			const { data, error } = await gameCard.getGameCard(gameData?.gameSlug);
			if (data) {
				game.cards = data?.card;
				game.gameName = data?.name;
				game.duration = data?.card_flip_interval_in_ms * 1000;
				game.shuffleCard = Array.from(data?.card)
					.sort(() => Math.random() - 0.5)
					.map((s) => s.id);
				// console.log(game.gameStyle);
				game.gameStyle = data?.layout;
				sio.sockets
					.in(gameData?.gameId)
					.emit(
						"connected",
						game.cards,
						game.duration,
						game.gameName,
						game.gameSlug,
						game.gameStyle
					);
				sio.sockets.in(gameData?.gameId).emit("newRGameCreated", game.winCron);
			}
			if (error) {
				sio.sockets.in(gameData?.gameId).emit("error", { message: error });
			}
		}
	});
	//
};
