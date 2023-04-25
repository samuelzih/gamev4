// @ts-nocheck
require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
var cookieParser = require("cookie-parser");
var session = require("express-session");
var flash = require("connect-flash");
const axios = require("axios").default;
const { check, body, validationResult } = require("express-validator");
const { Server } = require("socket.io");
const oneDay = 1000 * 60 * 60 * 24;
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/node_modules"));
app.use(express.static(path.join(__dirname, "game")));
app.use(express.static(path.join(__dirname, "public")));
// Import the  game file.
var loteria = require("./game/loteriaGame");
var game = require("./game/gameCard");
var gameList = require("./game/game");
// cookie and session
app.use(cookieParser());
app.use(flash());
const sessionMiddleware = session({
	secret: "1EEA6DC-JAM4DP2-PHVYPBN-V0XCJ9X",
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: oneDay,
	},
});
app.use(sessionMiddleware);

var server = require("http")
	.createServer(app)
	.listen(process.env.PORT || 3000, () => {
		var port = server.address()?.port;
		// console.log(server);
		console.log(`Server is running on portzznew ` + port);
	});

var io = new Server(server);

const redirectHome = (req, res, next) => {
	if (!req.session.orgId) {
		req.flash("error", "Unauthorized Access");
		return res.redirect("/");
	} else {
		next();
	}
};

const auth = (req, res, next) => {
	if (!req.session.token) {
		if (req.session.orgId) {
			req.flash("error", "You must be logged in to access that page");
			return res.redirect("/games");
		} else {
			req.flash("error", "Unauthorized Access");
			return res.redirect("/");
		}
	} else {
		next();
	}
};

const restrictToTeacher = (req, res, next) => {
	if (req.session.token) {
		req.flash("error", "Only student can view that page");
		return res.redirect(`/games/`);
	} else {
		if (!req.session.orgId) {
			req.flash("error", "Unauthorized Access");
			return res.redirect("/");
		}
		next();
	}
};

app.use((req, res, next) => {
	const { orgId, token, currUser } = req.session;
	res.locals.alerts = req.flash();
	if (orgId) {
		if (token) {
			res.locals.token = token;
			res.locals.currUser = currUser;
		}
		res.locals.orgId = orgId;
	}
	next();
});
// router

// home page

app
	.get("/", function (req, res) {
		res.render("pages/index", { title: "Card Game" });
	})
	.post("/", function (req, res) {
		const { orgId } = req.body;
		req.session["orgId"] = orgId;
		if (orgId) {
			return res.redirect("/games");
		} else {
			req.flash("error", "Something went wrong");
			return res.redirect("/");
		}
	});

// list page
app.get("/games", redirectHome, function (req, res) {
	const { orgId, currUser } = res.locals;
	axios
		.get(process.env.API_URL + "school/get-game-by-school/" + orgId)
		.then((resp) => {
			if (resp?.data?.status && resp?.data?.data.length > 0) {
				res.render("pages/games", {
					orgId: orgId,
					res: resp.data,
					user: currUser,
				});
			} else {
				req.flash("error", "Sorry, No game found");
				res.redirect("/");
			}
		})
		.catch((err) => {
			req.flash(
				"error",
				"OPPs! something went wrong while setting up request."
			);
			res.redirect("/");
		});
});

// games page
app.get("/games/:gameSlug", restrictToTeacher, async (req, res) => {
	const { orgId } = res.locals;
	const { data, error } = await game.getGameCard(req.params.gameSlug);
	if (data) {
		res.render("pages/game-landing", { orgId: orgId, res: data });
	} else {
		req.flash("error", error);
		res.redirect("/games");
	}
});

// single player
app.get(
	"/games/:gameSlug/single-player",
	restrictToTeacher,
	async (req, res) => {
		const { orgId } = res.locals;
		const { data, error } = await game.getGameCard(req.params.gameSlug);
		if (data) {
			res.render("pages/single-player", {
				orgId: orgId,
				org_name: data?.school,
				game_name: data?.name,
				gameSlug: req.params.gameSlug,
			});
		}
	}
);

// multi player
app.get(
	"/games/:gameSlug/multi-player",
	restrictToTeacher,
	async (req, res) => {
		const { orgId } = res.locals;
		const { data, error } = await game.getGameCard(req.params.gameSlug);
		if (data) {
			res.render("pages/multi-player", {
				orgId: orgId,
				org_name: data?.school,
				game_name: data?.name,
				gameSlug: req.params.gameSlug,
				roomId: "",
			});
		}
	}
);

// teacher as host
app.get("/games/:gameSlug/host", auth, async (req, res) => {
	const { orgId, currUser } = res.locals;
	const { data, error } = await game.getGameCard(req.params.gameSlug);
	const { gameData, gameErr } = await gameList.getGame(orgId);
	if (data) {
		res.render("pages/host", {
			user: currUser,
			org_name: data?.school,
			game_name: data?.name,
			gameSlug: req.params.gameSlug,
			gameList: gameData,
			gameStyle: 3,
		});
	}
});

// short url redirect
app.get("/shared/:url", function (req, res) {
	axios
		.get(process.env.API_URL + "school/fetch-url?code=" + req.params.url)
		.then((resp) => {
			if (resp?.data?.data?.full_url) {
				res.redirect(resp?.data?.data?.full_url);
			} else {
				req.flash("error", "Shared link is expired.");
				res.redirect("/");
			}
		})
		.catch((err) => {
			req.flash(
				"error",
				"OPPs! something went wrong while setting up request."
			);
			res.redirect("/");
		});
});

app.get("/games/:gameSlug/player/:roomID", async (req, res) => {
	const { data, error } = await game.getGameCard(req.params.gameSlug);
	if (data) {
		res.render("pages/players", {
			roomId: req.params.roomID,
			org_name: data?.school,
			game_name: data?.name,
			gameSlug: req.params.gameSlug,
		});
	}
});

// students as player
app.get("/games/:gameSlug/multi-player/:roomID", async (req, res) => {
	const { data, error } = await game.getGameCard(req.params.gameSlug);
	if (data) {
		res.render("pages/multi-player", {
			org_name: data?.school,
			game_name: data?.name,
			gameSlug: req.params.gameSlug,
			roomId: req.params.roomID,
		});
	}
});
// login page
app.post(
	"/login",
	check("username")
		.notEmpty()
		.withMessage("Email Address is required")
		.isEmail()
		.withMessage("Enter valid email address"),
	check("password").notEmpty().withMessage("Password is required"),
	function (req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
		axios
			.post(process.env.API_URL + "admin/login", {
				email: req.body.username,
				password: req.body.password,
				role: 3,
			})
			.then((resp) => {
				if (resp?.data?.success) {
					req.session["token"] = resp?.data?.token;
					req.session["orgId"] = resp?.data?.data?.school_id;
					req.session["currUser"] = resp?.data?.data;
					return res.status(200).json({ url: `/games/` });
				} else {
					return res.status(400).json({ errors: resp?.data?.message });
				}
			})
			.catch((err) => {
				return res.status(400).json({ errors: err });
			});
	}
);

// logout
app.get("/logout", redirectHome, (req, res) => {
	req.session.destroy;
	// console.log(req.session);
	res.clearCookie("connect.sid");
	res.redirect("/");
});

app.get("*", (req, res) => {
	req.flash("error", "Page not found");
	const { orgId } = res.locals;
	if (orgId) {
		res.redirect("/games");
	} else {
		res.redirect("/");
	}
});
// error handle

// will print stacktrace
if (app.get("env") === "development") {
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render("pages/error", {
			message: err.message,
			error: err,
		});
	});
}

// production error handler
app.use(function (err, req, res, next) {
	res.locals.user = req.session.currTeacher;
	next();
	res.status(err.status || 500);
	res.render("pages/error", {
		message: err.message,
		error: {},
	});
});

io.use((socket, next) => {
	sessionMiddleware(socket.request, {}, next);
});

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.on("connection", (socket) => {
	loteria.initGame(io, socket);
});
