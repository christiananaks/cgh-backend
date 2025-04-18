import mongoose, { Schema, Model } from "mongoose";

const gameDownloadSchema = new Schema<IGameDownload, IModelGameDownload>({
    title: {
        type: String,
        required: true
    },
    desc: {
        type: String
    },
    platform: {
        type: String,
        required: true,
        enum: ['PS5', 'PS4', 'NINTENDO SWITCH', 'GAMING PC', 'PS VITA', 'ASUS ROG ALLY/STEAMDECK or others']
    },
    imageUrl: {
        type: String
    },
    gameList: {
        type: [
            {
                type: String,
                required: true
            }
        ],
        required: true
    },
    installType: {
        type: String,
        required: true,
        enum: ['PACKAGE COLLECTION', 'JAILBREAK BUNDLE', 'JAILBREAK SELECTION']
    },
    price: {
        type: Number,
        required: true
    },
    installDuration: {
        type: String
    },
    homeService: {
        type: String,
        default: 'NO',
        enum: ['YES', 'NO'],
        required: true
    }

});

interface IModelGameDownload extends Model<IGameDownload, {}> {

}

export interface IGameDownload {
    title: string;
    desc: string | null;
    platform: string;
    imageUrl: string | null;
    gameList: string[];
    installType: string;
    price: number;
    installDuration: string | null;
    homeService: string;
    _doc?: Omit<this, '_doc'>;
}

const GameDownload = mongoose.model<IGameDownload, IModelGameDownload>('GameDownload', gameDownloadSchema);
export default GameDownload;

