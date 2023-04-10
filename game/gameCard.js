const _axios = require('axios').default;

exports.getGameCard = async (gameSlug) => {
    try {
        return {
            data: (await _axios.get(`${process.env.API_URL}school/get-cards-by-slug/${gameSlug}`)).data.data
        };
    } catch (error){
        return {error: error.message};        
    }
}


exports.getShareURL = async (url) => {
    try {
        return {
            data: (await _axios.post(`${process.env.API_URL}school/create/short-url`, { "full_url": url })).data.data
        };
    } catch (error){
        return {error: error.message};        
    }
}