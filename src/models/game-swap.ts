import mongoose, { Model, Schema } from "mongoose";

import { allGenre, resolverErrorChecker, validatePriceFormat } from "../util/helper.js";
import { TActionStatus } from "./type-def.js";
import Product from "./product.js";
import { clearImage } from "../util/file-storage.js";


const gameSwapSchema = new Schema<IGameSwap, IGameSwapModel>({
    title: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true,
        minlength: 1
    },
    platform: {
        type: String,
        required: true,
        enum: ['PS4', 'PS5', 'NINTENDO SWITCH', 'XBOX SERIES']
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Pre-owned', 'Used']
    },
    genre: {
        type: [
            {
                type: String,
                required: true,
            }
        ],
        required: true
    },
    desc: String,
    yearOfRelease: {
        type: String,
        required: true,
        minlength: 1
    },
    swapFee: {
        type: Number,
        required: true
    },
    acceptedTitles: {
        type: [
            {
                type: String,
                required: true
            }
        ],
        default: null
    }
});



interface IGameSwapModel extends Model<IGameSwap> {
    newGameSwap(queryInput: IGameSwap): Promise<TActionStatus>;
    delGameSwap(id: string): Promise<TActionStatus>;
}

export interface IGameSwap {
    title: string;
    imageUrl: string;
    platform: string;
    condition: string;
    genre: string[];
    desc: string | null;
    yearOfRelease: string;
    swapFee: number;
    acceptedTitles: string[] | null;
    _doc?: Omit<this, '_doc'>;
}

gameSwapSchema.index({ title: 1, platform: 1 }, { name: '_docEssential', unique: true });


gameSwapSchema.statics.newGameSwap = async function (queryInput: IGameSwap) {
    const { title, genre, swapFee } = queryInput;

    resolverErrorChecker({
        condition: validatePriceFormat(swapFee),
        message: 'Invalid price format.\nToo many numbers after decimal point, expected two numbers or less :(',
        code: 422
    });

    // genre input validation / 
    let allGenresCopy = new Set([...allGenre]);
    genre.forEach((word) => {
        allGenresCopy.add(word);
        if (allGenresCopy.size > allGenre.size) {
            const error: { [key: string]: any } = new Error(`Error: Invalid genre: ${word}`);
            error.statusCode = 422;
            throw error;
        }
    });
    /***************************************** */

    // Update product swap value if prod exists /
    await Product.findOneAndUpdate({ category: 'Game Disc', subcategory: queryInput.platform, title: queryInput.title }, { swap: true });
    /***************************************** */

    await this.create(queryInput);

    return { success: true, message: `GameSwap ${title} created successfully!` };

}

gameSwapSchema.statics.delGameSwap = async function (id) {
    const deletedDoc = await GameSwap.findByIdAndDelete(id);
    resolverErrorChecker({ condition: !deletedDoc, message: 'Error: Content not found!', code: 404 });

    /** Update product swap value if found */
    await Product.findOneAndUpdate({ category: 'Game Disc', subcategory: deletedDoc!.platform, title: deletedDoc!.title }, { swap: false });
    /***************************************** */

    clearImage(deletedDoc!.imageUrl);

    return { success: true, message: `Successfully deleted GameSwap: ${deletedDoc?.title}!` };
}

const GameSwap = mongoose.model<IGameSwap, IGameSwapModel>('GameSwap', gameSwapSchema);

export default GameSwap;