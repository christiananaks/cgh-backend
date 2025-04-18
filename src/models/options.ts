import mongoose, { Schema, Types, Model } from "mongoose";


const optionsSchema = new Schema<IOptions, Model<IOptions>>({
    defaultCurrency: {
        type: {
            currencyTitle: {
                type: String,
                required: true
            },
            currency: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: 'Currency'
            }
        },
        required: true
    }
});

export interface IOptions {
    defaultCurrency: { currencyTitle: string, currency: Types.ObjectId };
}

const Options = mongoose.model<IOptions, Model<IOptions>>('Options', optionsSchema);
export default Options;