const _axios = require('axios').default;

exports.getGame = async (orgId) => {
    try {
        return {
            gameData: (await _axios.get(`${process.env.API_URL}school/get-game-by-school/${orgId}`)).data.data
        };
    } catch (error){
        return {gameErr: error.message};        
    }
}