import { GraphQLCustomError, calPrice } from '../util/helper.js';
import { ICurrency } from './currency.js';
import { ProductData } from './product.js';

import { Schema, model, Types, Model, HydratedDocument } from 'mongoose';

interface CategoryModel extends Model<CategoryData> {
    getCategoryProds(catTitle: string, currency: ICurrency): Promise<ProductData[]>;
    getDbCategories(): Promise<{ id: string, title: string, subcategories: string[] }[]>;
}

interface CategoryData {
    title: string;
    subcategoryData: Types.Map<Types.ObjectId[]>;
    addToCategory: (product: HydratedDocument<ProductData>) => Promise<void>;
    categoryIds: Types.Map<Types.ObjectId[]>;
}

export interface ICategory extends CategoryData, Document {
    _doc: Omit<this, '_doc'>;
}

const categoriesSchema = new Schema<CategoryData, CategoryModel>({
    title: {
        type: String,
        required: true,
        unique: true
    },
    subcategoryData: {
        type: Map,
        of: [{ type: Schema.Types.ObjectId, required: true, ref: "Product" }],
        validate: {
            validator: function (map: Map<string, Types.ObjectId[]>) {
                const VALID_KEYS = [
                    'ps4', 'ps5', 'nintendo switch 2', 'nintendo switch',
                    'xbox series x/s', 'xbox one', 'handheld/portable', 'pc',
                ];
                return Array.from(map.keys()).every((key: string) => VALID_KEYS.includes(key.toLowerCase()));
            },
            message: " props => `${Object.keys(props.value)} contains invalid keys!`",

        },
        required: true
    }

},);

// callable on instantiated object of this schema
categoriesSchema.methods.addToCategory = async function (product: HydratedDocument<ProductData>): Promise<void> {
    this.subcategoryData.set(product.subcategory, [...this.subcategoryData.get(product.subcategory), product._id]); // adds the new product id to the existing subcategory empty array
    await this.save();
}

categoriesSchema.statics.getCategoryProds = async function (categoryTitle: string, currency: ICurrency): Promise<ProductData[]> {
    const category = await this.findOne({ title: categoryTitle }).populate('subcategoryData.$*');

    if (!category) {
        throw new GraphQLCustomError('Category not found.', 404);
    }

    let categoryProducts: unknown[] = Array.from(category.subcategoryData.values()).flatMap((arr) => {
        arr.forEach((obj: any, index) => {
            const price = calPrice(+obj.price, currency);
            arr[index] = { ...obj._doc, id: obj._id.toString(), price: price };
        });
        return arr;
    });

    return categoryProducts as ProductData[];
};

categoriesSchema.statics.getDbCategories = async function (): Promise<{ id: string, title: string, subcategories: string[] }[]> {
    const categories = await this.find().select('title subcategoryData');
    const categoriesList = categories.map(doc => {
        const subcategories = Array.from(doc.subcategoryData.keys());
        return { id: doc.id, title: doc.title, subcategories: subcategories };
    });

    return categoriesList;
}

const Category = model<CategoryData, CategoryModel>('Category', categoriesSchema);
export default Category;
