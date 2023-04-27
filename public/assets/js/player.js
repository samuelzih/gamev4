// @ts-nocheck
Array.prototype.remove = function (from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};
jQuery(
	(function ($) {
		"use strict";
		const gameObject = {
			card: [],
			gameId: "",
			mySocketId: "",
			role: "",
			playerName: "",
			url: "",
			winCron: "",
			gameName: "",
			gameSlug: "",
			gameType: "classroom",
			duration: "",
			loader: { images: {} },
			gameAssets: {},
			players: [],
			gameSound: [],
			gameStart: false,
			gameStyle: 4,
			selectCards: [],
			drawCards: [],
			shuffleIndex: 0,
			gameOver: false,
			convertFormToJSON: (form) => {
				return $(form)
					.serializeArray()
					.reduce(function (json, { name, value }) {
						json[name] = value;
						return json;
					}, {});
			},
			share: (shareTextArea, gameCode) => {
				if (navigator.share) {
					navigator.share({
						title: "Loteria Game",
						text: "Come join my game!",
						url: document.getElementById(shareTextArea).value,
					});
				} else {
					const copy = document.getElementById(shareTextArea);
					copy.select();
					copy.setSelectionRange(0, 9999);
					document.getElementById(gameCode).classList.remove("d-none");
				}
			},
			copyShare: (shareTextArea, gameCode) => {
				const copy = document.getElementById(shareTextArea);
				copy.select();
				document.execCommand("copy");
				document.getElementById(gameCode).classList.add("d-none");
			},
			setGameSound: (cards) => {
				let gameSounds = [];
				cards.forEach((el) => {
					gameSounds[el?.id] = new Howl({
						src: [el?.card_voice],
						html5: true,
						volume: 0,
					});
				});
				return gameSounds;
			},
			preloaderMedia: (images, socket) => {
				gameObject.gameAssets = new Preloader({
					images: images,
					onProgress: function (current, outOf, percentage) {
						$("#gamePreloader")
							.find(".progress-data")
							.html(`<p>${current} / ${outOf} </p>`);
						$("#gamePreloader")
							.find(".progress-bar")
							.css("width", percentage.floor() + "%");
					},
					onComplete: function (assets, amount, time) {
						setTimeout(() => {
							const data = {
								roomId: gameObject.gameId,
								mySocketId: gameObject.mySocketId,
								role: gameObject.role,
							};
							socket.emit("gameStart", data);
						}, 1000);
					},
				});
				gameObject.gameAssets.load();
			},
			playSound: (soundID) => {
				if (!soundID) {
					return;
				}
				gameObject.gameSound[soundID].volume(1);
				gameObject.gameSound[soundID].play();
				gameObject.gameSound[soundID].on("play", function () {
					$(document).find(
						"#replay"
					).html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
          </svg>`);
					$(document).find("#replay").prop("disabled", true);
				});
				gameObject.gameSound[soundID].on("end", function () {
					$(document).find(
						"#replay"
					).html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
          </svg>`);
					$(document).find("#replay").prop("disabled", false);
				});
			},
			replaySound: () => {
				if (gameObject.shuffleIndex > 0) {
					gameObject.gameSound[
						gameObject.shuffleCards[gameObject.shuffleIndex - 1]
					].play();
				}
			},
			unLoadSound: (lastCardIndex) => {
				gameObject.gameSound[lastCardIndex].stop();
			},
		};
		var initCard = {
			wincon1: "/assets/img/wincon1.svg",
			wincon2: "/assets/img/wincon1.svg",
			wincon4: "/assets/img/wincon3.svg",
			wincon5: "/assets/img/wincon5.svg",
			selected: "/assets/img/selected-card.svg",
			wrong: "/assets/img/wrong-card.svg",
			g: "/assets/img/G.png",
			back: "/assets/img/back.jpg",
		};

		let init = new Preloader({
			images: initCard,
			onProgress: function (current, outOf, percentage) { },
			onComplete: function (assets, amount, time) { },
		});
		init.load();
		var IO = {
			init: function () {
				// IO.socket = io('http://ec2-35-170-246-227.compute-1.amazonaws.com:3000/');
				IO.socket = io.connect(window.location.origin);
				IO.bindEvents();
			},
			bindEvents: function () {
				IO.socket.on("connected", IO.onConnected);
				IO.socket.on("joinedGame", IO.onJoinedGame);
				IO.socket.on("loadingAssets", IO.onLoadingAssets);
				IO.socket.on("gameHasBeenStarted", IO.onGameHasBeenStarted);
				IO.socket.on("currentCard", IO.onCurrentCard);
				IO.socket.on("check winner", IO.onEndGame);
				IO.socket.on("GameOver", IO.onEndGame);
				IO.socket.on("result", IO.result);
				IO.socket.on("teacherLeft", IO.onHostLeft);
				IO.socket.on("studentLeft", IO.onDisconnect);
				IO.socket.on("error", IO.errorMessage);
				IO.socket.on("connect_error", (err) => {
					toastr.error(`connect_error due to ${err.message}`);
				});
				IO.socket.on("new Game", IO.onNewGame);
				IO.socket.on("waiting lobby", IO.waitingLobby);
				IO.socket.on("newRGameCreated", IO.onNewRGameCreated);
			},

			onConnected: function (cards, duration, gameName, gameSlug, gameStyle) {
				$("#gamePreloader").find(".progress-data").html(``);
				$("#gamePreloader").find(".progress-bar").css("width", "0%");
				gameObject.gameOver = false;
				gameObject.loader.images = {};
				gameObject.gameAssets = {};
				if (!gameObject.mySocketId) {
					gameObject.mySocketId = IO.socket.id;
				}
				gameObject.gameName = gameName;
				gameObject.duration = duration;
				gameObject.card = cards;
				gameObject.gameSlug = gameSlug;
				gameObject.gameStyle = parseInt(gameStyle);
				gameObject.selectCards = Array(gameStyle)
					.fill(0)
					.map(function () {
						return Array(gameStyle)
							.fill(0)
							.map(function () {
								return {
									state: 0,
									card: 0,
								};
							});
					})
				if (gameObject.gameName && gameObject.duration) {
					console.log(
						"gameobject assigned for %s with card length %s",
						gameObject.gameName,
						gameObject.card.length
					);
					App.$doc
						.find("#joinRoom .submit_btn")
						.removeClass("loading")
						.prop("disabled", false);
				}
				Array.from(cards).forEach((el) => {
					gameObject.loader.images[el?.id] = el?.card_image;
				});
			},

			onJoinedGame: function (data) {
				gameObject.winCron = data?.winCron;
				App.waitingScreen(data?.winCron);
			},

			onLoadingAssets: function () {
				App.$doc
					.find(".waitingForHost")
					.removeClass("d-flex")
					.addClass("collapse");
				App.$doc
					.find("#gamePreloader")
					.removeClass("collapse")
					.addClass("d-flex");
				gameObject.preloaderMedia(gameObject.loader.images, IO.socket);
			},

			onGameHasBeenStarted: function (data) {
				gameObject.gameStart = data?.gameStarted;
				gameObject.shuffleCards = data?.shuffleCards;
				gameObject.drawCards = [];
				App.$doc
					.find("#gamePreloader")
					.removeClass("d-flex")
					.addClass("collapse");
				App.showPlayerBoard();
				App.matrixBoard();
				IO.socket.emit("startShuffle", gameObject.gameId);
				gameObject.gameSound[data?.shuffleCards[0]].play();
			},

			onCurrentCard: function (data) {
				App.stdCurrShuffle(data);
			},

			onEndGame: function () {
				// gameObject.gameOver = true;
				App.endGame();
			},

			result: function (data) {
				App.scoreBoard(data);
			},

			onNewGame: function () {
				toastr.warning("Game Over. Bye", { positionClass: "toast-top-center" });
				setTimeout(() => {
					window.location.href = "/";
				}, 1500);
			},

			onHostLeft: function (data) {
				toastr.warning("Host left game.", {
					positionClass: "toast-top-center",
				});
				setTimeout(() => {
					window.location.href = "/";
				}, 1500);
			},

			onDisconnect: function (data) {
				// if (App.mySocketId === data?.id) {
				//     toastr.info(`${App.myName}, Please Join Again`);
				//     window.location.reload();
				// }
			},

			errorMessage: function (data) {
				if (data?.message) {
					toastr.error(data?.message);
				} else {
					toastr.error(
						"Something Went Wrong, Please Try Again. <br> <a href='/'>Back to Home</a>",
						{ positionClass: "toast-top-center" }
					);
				}
			},

			waitingLobby: () => {
				let myModalEl = document.querySelector("#winnerModal");
				let modal = bootstrap.Modal.getOrCreateInstance(myModalEl);
				modal.hide();
				App.$doc
					.find(".waitingForHost")
					.addClass("d-flex")
					.removeClass("collapse");
				gameObject.selectCards = Array(gameObject.gameStyle)
					.fill(0)
					.map(function () {
						return Array(gameObject.gameStyle)
							.fill(0)
							.map(function () {
								return {
									state: 0,
									card: 0,
								};
							});
					});
			},

			onNewRGameCreated: (winCron) => {
				gameObject.shuffleIndex = 0;
				gameObject.winCron = winCron;
				App.$doc.find("#loteria").prop("disabled", true);
				App.$doc
					.find("#suffleCard .cardImg")
					.css({ "background-image": "url(" + initCard["g"] + ")" });
				App.$doc.find(".gameName").text(gameObject.gameName);
				App.$doc
					.find("#joinRoom input[name=gameSlug]")
					.val(gameObject.gameSlug);
				App.$doc.find("#winCon .patternName").html(gameObject.winCron?.value);
				App.$doc
					.find("#winCon .winPattern")
					.html(
						`<img src="${gameObject.winCron['url_' + gameObject.gameStyle]}" alt="${gameObject.winCron?.value}">`
					);
				App.startMatrixBoard();
				App.$doc.find("#replay").prop("disabled", true);
				gameObject.gameSound = gameObject.setGameSound(gameObject.card);
			},
		};

		var App = {
			init: function () {
				App.cacheElements();
				App.bindEvents();
			},
			cacheElements: function () {
				App.$doc = $(document);
				App.$gameArea = $("#multipleBoard");
				App.$joinRoomBtn = $("#joinRoom");
				App.$gameArea
					.find(".full-grid")
					.removeClass("h-100 place-content-normal");
			},
			bindEvents: function () {
				App.$doc.on("submit", "#joinRoom", App.onPlayerJoin);
				App.$doc.on("click", ".matrix__cell", App.matchCard);
				App.$doc.on("click", "#loteria", App.onSubmit);
				App.$doc.on("click", "#replay", () => {
					gameObject.replaySound();
				});
			},
			onPlayerJoin: (event) => {
				event.preventDefault();
				$(event.target)
					.find(".submit_btn")
					.addClass("loading")
					.prop("disabled", true);
				const form = $(event.target);
				let data = gameObject.convertFormToJSON(form);
				gameObject.playerName = data["playerName"] || "Anonymous";
				gameObject.role = data["role"];
				gameObject.gameId = data["gameId"];
				IO.socket.emit("onPlayerJoinGame", data, gameObject.gameType);
				gameObject.gameSound = gameObject.setGameSound(gameObject.card);
			},
			waitingScreen: () => {
				App.$doc.find(".gameName").text(gameObject.gameName);
				App.$doc
					.find("#joinRoom input[name=gameSlug]")
					.val(gameObject.gameSlug);
				App.$doc
					.find("#joinRoom .submit_btn")
					.removeClass("loading")
					.prop("disabled", false);
				App.$doc.find("#board table .matrix__cell .game-cell").css("height", Math.floor((window.innerHeight - 110) / gameObject.gameStyle))
				App.$doc.find("#loginForm").addClass("collapse");
				App.$doc.find("#gameBoard").removeClass("collapse");
				App.$doc
					.find(".waitingForHost")
					.removeClass("collapse")
					.addClass("d-flex");
				App.$doc.find(".userName").text(gameObject.playerName);
				App.$doc.find("#winCon .patternName").html(gameObject.winCron?.value);
				App.$doc
					.find("#winCon .winPattern")
					.html(
						`<img src="${gameObject.winCron['url_' + gameObject.gameStyle]}" alt="${gameObject.winCron?.value}">`
					);
				App.$doc.find(".full-grid").addClass("h-100 place-content-normal");
				App.startMatrixBoard();
			},
			showPlayerBoard: () => {
				App.$doc.find("#gameBoard").addClass("show");
				App.$doc.find("#loteria").removeAttr("disabled");
			},
			matrixBoard: () => {
				let str = "<table class='table'>";
				const cards = Array.from(gameObject.card);
				for (let row = 0; row < gameObject.gameStyle; row++) {
					str += "<tr>";
					for (let col = 0; col < gameObject.gameStyle; col++) {
						let randNum = Math.floor(Math.random() * cards.length);
						let numArray = cards[randNum];
						cards.remove(randNum);
						str += `<td class="matrix__cell" data-id="${numArray?.id}">
                            <div class="game-cell">
                                <img src="${numArray?.card_image}" alt="">                                        
                            </div>
                        </td>`;
						gameObject.selectCards[row][col].card = numArray?.id;
					}
					str += "</tr>";
				}
				str += "</table>";

				IO.socket.emit(
					"playerCard",
					gameObject.gameId,
					gameObject.mySocketId,
					gameObject.selectCards
				);
				App.$doc.find("#board").html(str);
				App.$doc.find("#board table .matrix__cell .game-cell").css("height", Math.floor((window.innerHeight - 110) / gameObject.gameStyle))
			},
			startMatrixBoard: () => {
				let assets = initCard["back"];
				console.log(gameObject.gameStyle);
				let str = "<table class='table'>";
				for (let row = 0; row < gameObject.gameStyle; row++) {
					str += "<tr>";
					for (let col = 0; col < gameObject.gameStyle; col++) {
						str += `<td class="matrix__cell">
                            <div class="game-cell">
                                <img src="${assets}" alt="">                                      
                            </div>
                        </td>`;
					}
					str += "</tr>";
				}
				str += "</table>";
				App.$doc.find("#board").html(str);
				App.$doc.find("#board table .matrix__cell .game-cell").css("height", Math.floor((window.innerHeight - 110) / gameObject.gameStyle))
			},
			stdCurrShuffle: (data) => {
				let currCard = data;
				if (gameObject.gameStart) {
					if (gameObject.shuffleIndex > 0) {
						gameObject.unLoadSound(
							gameObject.shuffleCards[gameObject.shuffleIndex - 1]
						);
					}
					gameObject.playSound(currCard);
					App.currDrawCard(currCard);
					gameObject.drawCards.push(currCard);
					if (gameObject.shuffleIndex++ >= gameObject.shuffleCards.length - 1) {
					} else {
						IO.socket.emit("nextCard", gameObject.gameId);
					}
				}
			},
			currDrawCard(cardId) {
				let card = gameObject.card.find((el) => el.id === cardId);
				if (!card) {
					console.log(gameObject.card, cardId, gameObject.shuffleCards);
				}
				App.$doc
					.find("#suffleCard .cardImg")
					.css({ "background-image": "url(" + card?.card_image + ")" });
			},
			matchCard: (e) => {
				if (gameObject.gameOver) {
					return;
				}
				let cellId = parseInt(e.currentTarget.getAttribute("data-id"));
				if (e.currentTarget.classList.contains("selected")) {
					return;
				}
				const check = gameObject.drawCards.some(function (e) {
					return !!(e === cellId);
				});
				let x = e.currentTarget.parentNode.rowIndex;
				let y = e.currentTarget.cellIndex;
				let mySocketId = gameObject.mySocketId;
				let roomId = gameObject.gameId;
				const selectedCell = {
					x: x,
					y: y,
					userId: mySocketId,
					roomId: roomId,
				};
				// console.log(gameObject.selectCards)
				if (check) {
					e.currentTarget.classList.add("selected");
					gameObject.selectCards[selectedCell.x][selectedCell.y].state = 1;
					IO.socket.emit("updateActivity", selectedCell, 1);
				} else {
					e.currentTarget.classList.add("wrong-card");
					IO.socket.emit("updateActivity", selectedCell, 0);
					setTimeout(() => {
						e.currentTarget.classList.remove("wrong-card");
						IO.socket.emit("updateActivity", selectedCell, 0);
					}, 600);
				}
			},
			onSubmit: (event) => {
				$(event.target).addClass("loading").prop("disabled", true);
				const selectCards = gameObject.selectCards;
				const shuffleCard = gameObject.shuffleCards;
				const winCron = gameObject.winCron;
				if (App.matchPattern(selectCards, shuffleCard, winCron.index)) {
					if (
						gameObject.gameSound[shuffleCard[gameObject.drawCards.length - 1]]
					) {
						gameObject.unLoadSound(
							shuffleCard[gameObject.drawCards.length - 1]
						);
					}
					IO.socket.emit("loteriaFirst", {
						userId: gameObject.mySocketId,
						roomId: gameObject.gameId,
						win: true,
					});
					gameObject.gameOver = true;
				} else {
					$("#board").addClass("ddlltr-fb");
					setTimeout(() => {
						$("#board").removeClass("ddlltr-fb");
						$(event.target).removeClass("loading").prop("disabled", false);
					}, 300);
				}
			},
			matchPattern: (a, b, c) => {
				if (0 == c) {
					if (gameObject.gameStyle === 3) {
						return App.match3RowCol(a, b);
					} else {
						return App.matchRowCol(a, b);
					}
				}
				// matchCorner
				else if (2 == c) {
					if (gameObject.gameStyle === 3) {
						return App.match3Corner(a, b);
					} else {
						return App.matchCorner(a, b);
					}
				}
				// matchCenter
				else if (3 == c) {
					if (gameObject.gameStyle === 3) {
						return App.match3Center(a, b);
					} else {
						return App.matchCenter(a, b);
					}
				}

				// matchDiagonal
				else if (4 == c) {
					if (gameObject.gameStyle === 3) {
						return App.match3Diagonal(a, b);
					} else {
						return App.matchDiagonal(a, b);
					}
				} else {
					return null;
				}
			},
			matchRowCol: (a, b) => {
				for (let i = 0; i < a.length; i++) {
					if (
						((d = [
							{
								row: i,
								col: 0,
							},
							{
								row: i,
								col: 1,
							},
							{
								row: i,
								col: 2,
							},
							{
								row: i,
								col: 3,
							},
						]),
							App.checkLoteria(d, a, b))
					) {
						return d;
					} else {
						var d = [
							{
								row: 0,
								col: i,
							},
							{
								row: 1,
								col: i,
							},
							{
								row: 2,
								col: i,
							},
							{
								row: 3,
								col: i,
							},
						];
						if (App.checkLoteria(d, a, b)) {
							return d;
						}
					}
				}
			},
			match3RowCol: (a, b) => {
				for (let i = 0; i < a.length; i++) {
					if (
						((d = [
							{
								row: i,
								col: 0,
							},
							{
								row: i,
								col: 1,
							},
							{
								row: i,
								col: 2,
							}
						]),
							App.checkLoteria(d, a, b))
					) {
						return d;
					} else {
						var d = [
							{
								row: 0,
								col: i,
							},
							{
								row: 1,
								col: i,
							},
							{
								row: 2,
								col: i,
							}
						];
						if (App.checkLoteria(d, a, b)) {
							return d;
						}
					}
				}
			},
			matchCorner: (a, b) => {
				function p(a) {
					var b =
						"undefined" != typeof Symbol &&
						Symbol.iterator &&
						a[Symbol.iterator];
					return b
						? b.call(a)
						: {
							next: aa(a),
						};
				}
				function aa(a) {
					var b = 0;
					return function () {
						return b < a.length
							? {
								done: !1,
								value: a[b++],
							}
							: {
								done: !0,
							};
					};
				}
				for (let g = p([0, 2]), d = g.next(); !d.done; d = g.next()) {
					d = d.value;
					for (var e = p([0, 2]), f = e.next(); !f.done; f = e.next()) {
						f = f.value;
						let arr = [
							{
								row: d,
								col: f,
							},
							{
								row: d + 1,
								col: f,
							},
							{
								row: d + 1,
								col: f + 1,
							},
							{
								row: d,
								col: f + 1,
							},
						];
						if (App.checkLoteria(arr, a, b)) {
							return arr;
						}
					}
				}
			},
			match3Corner: (a, b) => {
				let arr = [
					{
						row: 0,
						col: 0,
					},
					{
						row: 0,
						col: 2,
					},
					{
						row: 2,
						col: 0,
					},
					{
						row: 2,
						col: 2,
					},
				];
				if (App.checkLoteria(arr, a, b)) {
					return arr;
				}
			},
			matchCenter: (a, b) => {

				let d = [
					{
						row: 1,
						col: 1,
					},
					{
						row: 2,
						col: 1,
					},
					{
						row: 2,
						col: 2,
					},
					{
						row: 1,
						col: 2,
					},
					{
						row: 2,
						col: 0,
					},
					{
						row: 2,
						col: 1,
					},
					{
						row: 2,
						col: 2,
					},
					{
						row: 3,
						col: 3,
					},
					{
						row: 1,
						col: 2,
					},
					{
						row: 0,
						col: 2,
					},
					{
						row: 0,
						col: 3,
					},
					{
						row: 0,
						col: 1,
					},
					{
						row: 0,
						col: 0,
					},
					{
						row: 0,
						col: 0,
					},
					{
						row: 1,
						col: 0,
					},
					{
						row: 1,
						col: 1,
					},
				];
				if (App.checkLoteria(d, a, b)) {
					return d;
				}

				let f = [
					{
						row: 2,
						col: 0,
					},
					{
						row: 2,
						col: 1,
					},
					{
						row: 2,
						col: 2,
					},
					{
						row: 3,
						col: 3,
					},
					{
						row: 1,
						col: 2,
					},
					{
						row: 0,
						col: 2,
					},
					{
						row: 0,
						col: 3,
					},
					{
						row: 0,
						col: 1,
					},
					{
						row: 0,
						col: 0,
					},
					{
						row: 0,
						col: 0,
					},
					{
						row: 1,
						col: 0,
					},
					{
						row: 1,
						col: 1,
					},
				];
				if (App.checkLoteria(f, a, b)) {
					return f;
				}
			},
			match3Center: (a, b) => {
				let d = [
					{
						row: 0,
						col: 0,
					},
					{
						row: 0,
						col: 1,
					},
					{
						row: 0,
						col: 2,
					},
					{
						row: 1,
						col: 0,
					},
					{
						row: 1,
						col: 1,
					},
					{
						row: 1,
						col: 2,
					},
					{
						row: 2,
						col: 0,
					},
					{
						row: 2,
						col: 1,
					},
					{
						row: 2,
						col: 2,
					}
				];
				if (App.checkLoteria(d, a, b)) {
					return d;
				}
			},
			matchDiagonal: (a, b) => {
				let d = [
					{
						row: 0,
						col: 0
					}, {
						row: 1,
						col: 1
					}, {
						row: 2,
						col: 2
					}, {
						row: 3,
						col: 3
					}
				];
				if (App.checkLoteria(d, a, b)) {
					return d;
				}
				let f = [
					{
						row: 0,
						col: 3
					}, {
						row: 1,
						col: 2
					}, {
						row: 2,
						col: 1
					}, {
						row: 3,
						col: 0
					}
				];
				if (App.checkLoteria(f, a, b)) {
					return f;
				}
			},
			match3Diagonal: (a, b) => {
				// changes 3x3
				let d = [
					{
						row: 0,
						col: 0,
					},
					{
						row: 1,
						col: 1,
					},
					{
						row: 2,
						col: 2,
					}
				];
				if (App.checkLoteria(d, a, b)) {
					return d;
				}
				let f = [
					{
						row: 0,
						col: 2,
					},
					{
						row: 1,
						col: 1,
					},
					{
						row: 2,
						col: 0,
					}
				];
				if (App.checkLoteria(f, a, b)) {
					return f;
				}
			},
			checkLoteria: (a, b, c) => {
				// console.log(a, b, c);
				return a.reduce(function (d, e) {
					d &&
						((e = b[e.row][e.col]),
							(d = 1 == e.state && -1 != c.indexOf(e.card)));
					return d;
				}, !0);
			},
			endGame: () => {
				if (!gameObject.gameOver) {
					const selectCards = gameObject.selectCards;
					const shuffleCard = gameObject.shuffleCards;
					const winCron = gameObject.winCron;
					if (
						gameObject.gameSound[shuffleCard[gameObject.drawCards.length - 1]]
					) {
						gameObject.unLoadSound(
							shuffleCard[gameObject.drawCards.length - 1]
						);
					}

					if (App.matchPattern(selectCards, shuffleCard, winCron.index)) {
						IO.socket.emit("checkWinner", {
							userId: gameObject.mySocketId,
							roomId: gameObject.gameId,
							win: true,
						});
					} else {
						IO.socket.emit("checkWinner", {
							userId: gameObject.mySocketId,
							roomId: gameObject.gameId,
							win: false,
						});
					}
					gameObject.gameOver = true;
				}
			},
			scoreBoard: (data) => {
				let resultList = data;
				let resHTMl = "";
				resultList = resultList.sort((a, b) => {
					if (a.score > b.score) {
						return -1;
					}
					if (a.score < b.score) {
						return 1;
					}
					return 0;
				});
				const winners = resultList.filter((el) => el.score > 0);
				const result =
					winners.length > 1
						? `${winners
							.slice(0, -1)
							.map((el) => el?.name)
							.join(",")} & ${winners.slice(-1)[0]?.name}`
						: `${winners[0].name}`;
				if (winners.length > 0) {
					$(".winner-announcement")
						.removeClass("d-none")
						.html(
							`<span class="winnerName">${result}</span> wins the game!</h2>`
						);
				} else {
					$(".winner-announcement").addClass("d-none");
				}
				resultList.forEach((el) => {
					resHTMl += `<tr><td>${el.id === gameObject.mySocketId ? "You" : el.name
						}</td><td>${el.score}</td></tr>`;
				});
				$("#winner-wrap").html(resHTMl);
				let modal = bootstrap.Modal.getOrCreateInstance(winnerModal);
				modal.show();
			},
		};

		IO.init();
		App.init();
		$(window).on('resize', function () {
			let $board = $("#board");
			if ($board) {
				App.$doc.find("#board table .matrix__cell .game-cell").css("height", Math.floor((window.innerHeight - 110) / gameObject.gameStyle))
			}
		})
	})($)
);
