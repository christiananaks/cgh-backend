import mongoose, { Schema, Model } from "mongoose";

const trendingGamesSchema = new Schema<ITrendingGame, TrendingGamesModel, ITrendingGamesMethods>({
    title: {
        type: String,
        required: true
    },
    desc: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    imageUrl: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        required: true,
        default: 'PS5 | PS4 | NINTENDO SWITCH | XBOX SERIES | XBOX ONE | MICROSOFT WINDOWS'
    },
    genre: {
        type: String,
        required: true
    }
});

trendingGamesSchema.static('getTrendingGames', async function () {
    const games = await this.find().select('title desc rating imageUrl platform genre');
    if (1 > games.length) {
        return [];
    }
    const trendingGames = games.map((game) => {
        return { id: game.id, ...game._doc };
    });
    return trendingGames;
});


interface TrendingGamesModel extends Model<ITrendingGame, {}, ITrendingGamesMethods> {
    // static methods here
    getTrendingGames(): Promise<ITrendingGame[]>;
}

interface ITrendingGamesMethods {
    // add methods here
}

interface ITrendingGame {
    id: string;
    title: string;
    desc: string;
    rating: number;
    imageUrl: string;
    platform: string;
    genre: string;
    _doc?: Omit<this, '_doc'>;
}

const TrendingGames = mongoose.model<ITrendingGame, TrendingGamesModel>('TrendingGames', trendingGamesSchema);
export default TrendingGames;
