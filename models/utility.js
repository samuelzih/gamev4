// @ts-nocheck
var _ = require('lodash');
const { default: axios } = require("axios");
const ShortUniqueId = require('short-unique-id');
const winPattern = require("../game/wincron.json");
var gameCard = require("../game/gameCard");
const uid = new ShortUniqueId({ length: 6 });

Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};
// global variables
class Utility {
    constructor(io, socket) {
        this.io = io;
        this.gameSocket = socket;
        this.duration = 3500;
        this.gameName = "";
        this.gameSlug = "";
        this.gameType = "";
        this.winCron = winPattern.sort(() => Math.random() - 0.5)[0];
        this.shuffleCard = [];
        this.cards = [];
        this.gameId = uid();
        this.hostID = "";
        this.playerLimit = 1;
        this.started = false;
        this.players = [];
    }

    // assign game slug
    setGameSlug(slug) {
        this.gameSlug = slug;
    }

    getGameSlug(){
        return this.gameSlug;
    }

    // game type
    setGameType(data){
        this.gameType = data;
    }

    getGameType(){
        return this.gameType;
    }
    // game Name
    setGameName(name) {
        this.gameName = name;
    }

    getGameName() {
        return this.gameName;
    }
    // duration
    setDuration(duration){
        this.duration = duration;
    }

    getDuration(){
        return this.duration;
    }
    // game id
    getGameID(){
        return this.gameId;
    }
    // set host socket id 
    setHost(hostID) {
        this.hostID = hostID;
    }

    getHost() {
        return this.hostID;
    }
    // set winCron 
    setWinCon(winCon) {
        this.winCron = winPattern.filter(item => item.value === winCon)[0];
    }

    getWinCon() {
        return this.winCron;
    }

    // set Player
    setPlayerLimit(data) {
        this.playerLimit = data;
    }

    getPlayerLimit() {
        return this.playerLimit;
    }

    setShuffleCard(cards) {
        this.shuffleCard = cards.sort(() => Math.random() - 0.5).map(s => s.id);
    }

    getShuffleCard() {
        return this.shuffleCard;
    }

    // set card
    setCards(cards){
        this.cards = cards;
    }
    getCards(){
        return this.cards;
    }
    // add player
    addPlayer(player) {
        this.players.push(player);
    }
    // check game type 
    isSingle() {
        return this.gameType.toLowerCase() === "single";
    }
    isMultiple() {
        return this.gameType.toLowerCase() === "multiple";
    }
    isClassroom() {
        return this.gameType.toLowerCase() === "classroom";
    }
    
    // send game card data 
    async setGameCards(gameSlug) {
        this.setGameSlug(gameSlug);
        const { data, error } = await gameCard.getGameCard(gameSlug);
        if (data) {
            this.setDuration(data?.card_flip_interval_in_ms * 1000);
            this.setGameName(data?.name);
            this.setCards(data?.card);
            this.setShuffleCard(data?.card);
            this.gameSocket.emit('connected', data?.card, data?.card_flip_interval_in_ms * 1000, data?.name, gameSlug);
        } if(error){
            this.io.to(this.gameSocket.id).emit("error", { message: error });
        }
            
    }

    async onGameCreatedWithURL(url, gameData, socket, io){
        const { data, error } = await gameCard.getShareURL(url);
        if (data) {
            socket.emit("newGameCreated", {
                "gameId": gameData?.gameId,
                "mySocketId": socket.id,
                "role": gameData?.role,
                "playerName": gameData?.playerName,
                "url": '/shared/' + data?.code,
                "winCron": gameData?.winCon,
            });
            socket.join(gameData?.gameId.toString());
        } 
        if(error){
            io.to(socket.id).emit("error", { message: error });
        }
    }

    // create game object 
    createObject() {
        var loteria = this;
        var gameList = function () {
            this.cards = loteria.cards;
            this.duration = loteria.duration;           
            this.gameName = loteria.gameName;
            this.gameSlug = loteria.gameSlug;            
            this.gameType = loteria.gameType;
            this.gameId = loteria.gameId;
            this.hostID = loteria.hostID;
            this.started = loteria.started;           
            this.winCron = loteria.winCron;
            this.shuffleCard = loteria.shuffleCard;
            this.playerLimit = loteria.playerLimit;
            this.players = loteria.players;
        };
        return new gameList();
    }

    findPlayer(players, playerId) {
        var player = null;
        for (var i = 0; i < players.length; i++) {
            if (players[i].id == playerId) {
                player = players[i];
                break;
            }
        }
        return player;
    }
    
};







































module.exports = Utility;
