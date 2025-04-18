import mongoose, { Schema, Model } from "mongoose";

const gameRepairSchema = new Schema<IGameRepair, IGameRepairModel>({
    title: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    game: {
        type: String,
        required: true
    },
    desc: String,
    price: {
        type: Number,
        required: true
    },
    duration: String,
});

type IGameRepairModel = Model<IGameRepair>;

export interface IGameRepair {
    title: string;
    imageUrl: string | null;
    category: string;
    game: string;
    desc: string;
    price: number;
    duration: string;
    _doc?: Omit<this, '_doc'>;
}


const GameRepair = mongoose.model<IGameRepair, IGameRepairModel>('GameRepair', gameRepairSchema);
export default GameRepair;