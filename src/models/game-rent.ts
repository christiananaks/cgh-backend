import mongoose, { Model, Schema } from "mongoose";
import { TActionStatus } from "../graphql/types-def";
import Categories from "./categories";
import Product from "./product";
import { resolverErrorChecker, validatePriceFormat } from "../util/helper";
import { clearImage } from "../util/file-storage";

const gameRentSchema = new Schema<IGameRent, IGameRentModel>({
    title: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subCategory: {
        type: String,
        required: true
    },
    info: {
        type: String,
        required: true
    },
    rate: {
        type: Number,
        required: true
    }
});

gameRentSchema.static('newGameRent', async function (queryInput: IGameRent) {

    const { title, info, imageUrl } = queryInput;

    const inputValidation = [{ title: 2 > title.length }, { info: 5 > info.length }, { imageUrl: 1 > imageUrl.length }];
    inputValidation.forEach((e: any) => {
        const key = Object.keys(e)[0];
        resolverErrorChecker({ condition: e[key], message: key === 'imageUrl' ? 'Image cannot be empty' : `${key} is too short!`, code: 422 });
    });

    resolverErrorChecker({
        condition: validatePriceFormat(queryInput.rate),
        message: 'Invalid price format.\nToo many numbers after decimal point, expected two numbers or less :(',
        code: 422
    });

    // one-by-one input validation checking false value !value | !value using native if-check    //  ALT
    // if (1 > title.length || 10 > info.length || 1 > imageUrl.length) {
    //     const message = 1 > title.length ? 'Title is too short!' : 10 > info.length ? 'Info is too short' : 'ImageUrl cannot be empty!';
    //     const error: { [key: string]: any } = new Error(message);
    //     error.statusCode = 422;
    //     throw error;
    // }


    let prodCat = await Categories.find({ title: queryInput.category }).populate(`subcategoryData.${queryInput.subCategory}`).select('subcategoryData');
    resolverErrorChecker({ condition: 1 > prodCat.length, message: 'Error: Category does NOT exist.', code: 422 });



    await Product.findOneAndUpdate({ category: queryInput.category, subcategory: queryInput.subCategory, title: queryInput.title }, { rent: true });

    await GameRent.create(queryInput);

    return { success: true, message: `GameRent: ${queryInput.title} created successfully!` };
});

gameRentSchema.static('delGameRent', async function (id: string) {

    const foundGameRent = await this.findByIdAndDelete(id);

    resolverErrorChecker({ condition: !foundGameRent, message: 'Content not found!', code: 404 });

    await Product.findOneAndUpdate({ category: foundGameRent!.category, subcategory: foundGameRent!.subCategory, title: foundGameRent!.title }, { rent: false });

    clearImage(foundGameRent!.imageUrl);

    return { success: true, message: `GameRent: ${foundGameRent!.title} deleted successfully!` };

});

interface IGameRentModel extends Model<IGameRent> {
    newGameRent(queryInput: IGameRent): Promise<TActionStatus>;
    delGameRent(id: string): Promise<TActionStatus>;
}

interface IGameRent {
    title: string;
    imageUrl: string;
    category: string;
    subCategory: string;
    info: string;
    rate: number;
    _doc?: Omit<this, '_doc'>;
}

const GameRent = mongoose.model<IGameRent, IGameRentModel>('GameRent', gameRentSchema);
export default GameRent;