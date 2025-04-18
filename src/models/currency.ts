import mongoose, { Schema, Model } from "mongoose";

const currencySchema = new Schema<ICurrency, CurrencyModel>({
    country: {
        type: String,
        required: true
    },
    currency: {
        type: String,
        required: true
    },
    rate: {
        type: Number,
        required: true
    }
});

type CurrencyModel = Model<ICurrency>;

export interface ICurrency {
    country: string;
    currency: string;
    rate: number;
}

const Currency = mongoose.model<ICurrency, CurrencyModel>('Currency', currencySchema);
export default Currency;
