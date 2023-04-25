// @ts-nocheck
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
			getPlayerInRoom: () => {
				return gameObject.players.length;
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
			onProgress: function (current, outOf, percentage) {},
			onComplete: function (assets, amount, time) {},
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
				IO.socket.on("newGameCreated", IO.onNewClassGameCreated);
				IO.socket.on("playerJoined", IO.onStudentJoinedRoom);
				IO.socket.on("loadingAssets", IO.onLoadingAssets);
				IO.socket.on("gameHasBeenStarted", IO.onGameHasBeenStarted);
				IO.socket.on("shuffleStarted", IO.drawCard);
				IO.socket.on("oppenentCards", IO.onStudentCard);
				IO.socket.on("nextMove", IO.nextMove);
				IO.socket.on("oppStatus", IO.showOppStatus);
				IO.socket.on("check winner", IO.onEndGame);
				IO.socket.on("GameOver", IO.onEndGame);
				IO.socket.on("result", IO.result);
				IO.socket.on("studentLeft", IO.onStudentLeft);
				IO.socket.on("error", IO.errorMessage);
				IO.socket.on("connect_error", (err) => {
					toastr.error(`connect_error due to ${err.message}`);
				});
				IO.socket.on("new Game", IO.onNewGame);
				IO.socket.on("newRGameCreated", IO.onNewGameCreated);
			},

			onConnected: function (cards, duration, gameName, gameSlug, gameStyle) {
				gameObject.gameOver = false;
				gameObject.loader.images = {};
				gameObject.gameAssets = {};
				App.$doc.find("#playerGraph").html("");
				$("#gamePreloader").find(".progress-data").html(``);
				$("#gamePreloader").find(".progress-bar").css("width", "0%");
				if (!gameObject.mySocketId) {
					gameObject.mySocketId = IO.socket.id;
				}
				gameObject.gameName = gameName;
				gameObject.duration = duration;
				gameObject.card = cards;
				gameObject.gameSlug = gameSlug;
				gameObject.gameStyle = gameStyle;
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
						.find("#setRuleForm .submit_btn")
						.removeClass("loading")
						.prop("disabled", false);
				}
				Array.from(cards).forEach((el) => {
					gameObject.loader.images[el?.id] = el?.card_image;
				});
			},

			onNewClassGameCreated: function (data) {
				gameObject.gameId = data?.gameId;
				gameObject.winCron = data?.winCron;
				App.$doc.find("#roomNumber").text(data?.gameId);
				App.$doc.find(".gameName").text(gameObject.gameName);
				App.$doc
					.find("#setRuleForm input[name=gameSlug]")
					.val(gameObject.gameSlug);
				App.$doc.find("#shareTextArea").val(window.location.origin + data?.url);
				App.$doc.find("#gameBoard .patternName").text(data?.winCron.value);
				App.$doc
					.find("#gameBoard .winPattern")
					.html(
						`<img src="${gameObject.winCron['url_' + gameObject.gameStyle]}" alt="${gameObject.winCron?.value}">`
					);
				setTimeout(() => {
					App.$doc.find(".full-grid").addClass("h-100 place-content-normal");
					App.$doc.find("#setRuleForm").addClass("d-none");
					App.$doc
						.find("#setRuleForm .submit_btn")
						.removeClass("loading")
						.prop("disabled", false);
					App.$doc.find("#gameBoard").removeClass("d-none");
				}, 1000);
			},

			onStudentJoinedRoom: function (data) {
				gameObject.players.push(data);
				// console.log(gameObject.getPlayerInRoom());
				if (gameObject.getPlayerInRoom() > 0) {
					App.$doc.find("#hostStartGame").prop("disabled", false);
				}
				App.classRoomPlayers();
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
				App.$doc
					.find("#gamePreloader")
					.removeClass("d-flex")
					.addClass("collapse");
				App.$doc.find("#start").slideUp();
				App.$doc.find("#drawBtn").slideDown();
				IO.socket.emit("startShuffle", gameObject.gameId);
				gameObject.gameSound[data?.shuffleCards[0]].play();
			},

			drawCard: function () {
				$("#drawCard").removeClass("loading").prop("disabled", false);
			},

			onStudentCard: function (playerID, studentMatrix) {
				let assets = gameObject.card;
				studentMatrix.forEach(function (el, row) {
					el.forEach(function (data, col) {
						let card = assets.find((el) => el.id === data.card);
						$(`#${playerID} table tr:eq(${row}) td:eq(${col})`).html(
							`<img src="${card.card_image}" alt="">`
						);
					});
				});
			},

			nextMove: function () {
				setTimeout(() => {
					App.$doc
						.find("#drawCard")
						.removeClass("loading")
						.prop("disabled", false);
				}, 1500);
			},

			showOppStatus: function (data) {
				App.opponentBoardStatus(data);
			},

			onEndGame: function () {
				gameObject.gameOver = true;
			},

			result: function (data) {
				App.scoreBoard(data);
			},

			onNewGame: function () {
				toastr.warning("Game Over.", { positionClass: "toast-top-center" });
				setTimeout(() => {
					window.location.href = "/games";
				}, 1500);
			},

			onNewGameCreated: (winCron) => {
				gameObject.shuffleIndex = 0;
				gameObject.winCron = winCron;
				App.$doc.find(".gameName").text(gameObject.gameName);
				App.$doc
					.find("#setRuleForm input[name=gameSlug]")
					.val(gameObject.gameSlug);
				App.$doc.find("#gameBoard .patternName").text(winCron?.value);
				App.$doc
					.find("#gameBoard .winPattern")
					.html(`<img src="${gameObject.winCron['url_' + gameObject.gameStyle]}" alt="${gameObject.winCron?.value}">`);
				App.playersCardOpoenent();
				App.$doc.find("#currentCard").attr("src", initCard["g"]);
				App.$doc.find("#drawBtn").slideUp();
				App.$doc.find("#finished").slideUp();
				App.$doc.find("#start").slideDown();
				$("#hostStartGame").removeClass("loading").prop("disabled", false);
				$("#drawCard").removeClass("loading").prop("disabled", true);
				gameObject.gameSound = gameObject.setGameSound(gameObject.card);
				var myModalEl = document.querySelector("#newGameModal");
				var modal = bootstrap.Modal.getOrCreateInstance(myModalEl);
				modal.hide();
				App.$doc.find("#gamelist").slideDown();
				App.$doc.find("#newGameWinCon").slideUp();
				App.$doc.find("#replayGameForm")[0].reset();
				App.$doc
					.find("#replayGameForm .submit_btn")
					.removeClass("loading")
					.prop("disabled", false);
			},

			onStudentLeft: function (data) {
				// const leftPlayerIndex = App.Host.players.findIndex(item => item?.id === data?.id);
				// console.log(App.Host.players.findIndex(item => item?.id === data?.id));
				// if (leftPlayerIndex > -1) {
				//   toastr.info(`${App.Host.players[leftPlayerIndex]['playerName']} left game`, { "positionClass": "toast-top-center", });
				//   App.Host.players.splice(leftPlayerIndex, 1);
				//   $(`#${data.id}`).remove();
				// }
				// if (loteriaGame.getPlayerInRoom() < 1) {
				//   App.$gameArea.find("#invite").removeClass('collapse');
				//   $("#hostStartGame").prop('disabled', true);
				//   $("#drawCard").removeClass('loading').prop('disabled', false);
				//   App.$gameArea.find("#drawBtn").slideUp();
				//   App.$gameArea.find("#start").slideDown();
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
		};

		var App = {
			init: function () {
				App.cacheElements();
				App.bindEvents();
			},

			cacheElements: function () {
				App.$doc = $(document);
				App.$gameArea = $("#hostGameBoard");
				App.$setRuleBtn = $("#setRule");
				App.$gameArea
					.find(".full-grid")
					.removeClass("h-100 place-content-normal");
			},

			bindEvents: function () {
				App.$doc.on("submit", "#setRuleForm", App.onCreateNewGame);
				App.$doc.on("click", "#hostStartGame", App.onStartGame);
				App.$doc.on("click", "#drawBtn", App.teacherDrawCard);
				App.$doc.on("click", "#newGame", App.newGame);
				App.$doc.on("click", "#replay", App.replayGame);
				App.$doc.on("click", "#newGameBtn", App.newGameBtn);
				App.$doc.on("submit", "#replayGameForm", App.setRuleForm);
			},
			// onCreateNewGame
			onCreateNewGame: (event) => {
				event.preventDefault();
				$(event.target)
					.find(".submit_btn")
					.addClass("loading")
					.prop("disabled", true);
				const form = $(event.target);
				let data = gameObject.convertFormToJSON(form);
				data["url"] = window.location.href;
				if (!data?.winCon) {
					toastr.error("Game rule is required.");
					$(event.target)
						.find(".submit_btn")
						.removeClass("loading")
						.prop("disabled", false);
					return;
				}
				gameObject.role = data["role"];
				gameObject.playerName = data["playerName"];
				IO.socket.emit("createNewGame", data, gameObject.gameType);
				gameObject.gameSound = gameObject.setGameSound(gameObject.card);
			},

			classRoomPlayers: () => {
				App.$doc.find("#invite").addClass("collapse");
				App.$doc.find("#playerGraph").html("");
				App.playersCardOpoenent();
			},

			playersCardOpoenent: () => {
				let assets = initCard["back"];
				gameObject.players.forEach((el) => {
					if (gameObject.mySocketId !== el.id) {
						var opponent = document.createElement("div");
						var opponentTable = document.createElement("table");
						var opponentName = document.createElement("span");
						var row = document.createElement("tr");
						var cell = document.createElement("td");
						opponentTable.setAttribute("class", "player__table text-center");
						cell.setAttribute("class", "playercell");
						opponent.setAttribute("id", el.id);
						opponent.setAttribute("class", "player text-center");
						opponentName.setAttribute("class", "player_span text-white");
						opponentName.textContent = el?.name;
						for (let j = 0; j < gameObject.gameStyle; j++) {
							let cellJ = cell.cloneNode();
							cellJ.innerHTML = `<img src="${assets}" alt="">`;
							row.appendChild(cellJ);
						}
						for (let r = 0; r < gameObject.gameStyle; r++) {
							let rowR = row.cloneNode("true");
							opponentTable.appendChild(rowR);
						}
						opponent.appendChild(opponentTable);
						opponent.appendChild(opponentName);
						App.$doc.find("#playerGraph").append(opponent);
					}
				});
			},

			onStartGame: (event) => {
				event.preventDefault();
				$(event.target).addClass("loading").prop("disabled", true);
				IO.socket.emit("preLoader", gameObject.gameId);
			},
			teacherDrawCard: (event) => {
				event.preventDefault();
				if (gameObject.gameStart) {
					$(event.target).addClass("loading").prop("disabled", true);
					if (gameObject.shuffleIndex > 0) {
						gameObject.unLoadSound(
							gameObject.shuffleCards[gameObject.shuffleIndex - 1]
						);
					}
					let currCard = gameObject.shuffleCards[gameObject.shuffleIndex];
					gameObject.playSound(currCard);
					App.currDrawCard(currCard);
					if (gameObject.shuffleIndex++ >= gameObject.shuffleCards.length - 1) {
						IO.socket.emit("current card", currCard, gameObject.gameId);
						App.$doc.find("#drawBtn").slideUp();
						App.$doc.find("#finished").slideDown();
					} else {
						IO.socket.emit("current card", currCard, gameObject.gameId);
					}
				}
			},
			currDrawCard(cardId) {
				let card = gameObject.card.find((el) => el.id === cardId);
				// console.log(gameObject.card, cardId, gameObject.shuffleCards);
				App.$doc.find("#currentCard").attr("src", card?.card_image);
			},
			opponentBoardStatus: (data) => {
				const rowIndex = data?.row;
				const cellIndex = data?.cell;
				App.$doc
					.find(`#${data?.userId} table tr:eq(${rowIndex}) td:eq(${cellIndex})`)
					.toggleClass("beaned");
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
					resHTMl += `<tr><td>${el.name}</td><td>${el.score}</td></tr>`;
				});
				$("#winnerModal .modal-dialog").css("max-width", "600px");
				$("#winner-wrap").html(resHTMl);
				let modal = bootstrap.Modal.getOrCreateInstance(winnerModal);
				modal.show();
			},

			newGame: () => {
				IO.socket.emit("newGame", gameObject.gameId);
			},

			replayGame: () => {
				var winnerModalEl = document.querySelector("#winnerModal");
				let winnerModal = bootstrap.Modal.getOrCreateInstance(winnerModalEl);
				winnerModal.hide();
				var myModalEl = document.querySelector("#newGameModal");
				var modal = bootstrap.Modal.getOrCreateInstance(myModalEl);
				modal.show();
				IO.socket.emit("restartGame", gameObject.gameId);
			},

			newGameBtn: (event) => {
				event.preventDefault();
				$(event.target).addClass("loading").prop("disabled", true);
				if (
					App.$doc.find("#replayGameForm input[name=gameSlug]:checked").val()
				) {
					App.$doc.find("#gamelist").slideUp();
					App.$doc.find("#newGameWinCon").slideDown();
					$(event.target).removeClass("loading").prop("disabled", false);
				} else {
					toastr.error("Select Game", { positionClass: "toast-top-center" });
					$(event.target).removeClass("loading").prop("disabled", false);
				}
			},

			setRuleForm: (event) => {
				event.preventDefault();
				$(event.target)
					.find(".submit_btn")
					.addClass("loading")
					.prop("disabled", true);
				const form = $(event.target);
				let data = gameObject.convertFormToJSON(form);
				if (!data?.winCron) {
					toastr.error("Game rule is required.");
					$(event.target)
						.find(".submit_btn")
						.removeClass("loading")
						.prop("disabled", false);
					return;
				}
				data["gameId"] = gameObject.gameId;
				IO.socket.emit("newGameWithSameLobby", data);
			},
		};

		IO.init();
		App.init();

		document
			.getElementById("roomShare")
			?.addEventListener("click", function () {
				gameObject.share("shareTextArea", "gameCode");
			});

		document.getElementById("invite")?.addEventListener("click", function () {
			gameObject.share("shareTextArea", "gameCode");
		});

		document
			.getElementById("clipboard")
			?.addEventListener("click", function () {
				gameObject.copyShare("shareTextArea", "gameCode");
			});
	})($)
);
