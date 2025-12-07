import mongoose, { Types, Model } from 'mongoose';
import { resolverErrorChecker } from '../util/helper.js';
import validator from 'validator';


const inAppNoticeSchema = new mongoose.Schema<IInAppNotice, InAppNoticeModel>({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    imageUrl: String,
}, {
    statics: {
        createDoc: async function (input: IInAppNotice) {
            const title = input.title.trim();
            const content = input.content.trim();
            const imageUrl = input.imageUrl;

            resolverErrorChecker({ condition: !validator.isLength(title, { min: 7, max: 50 }), message: 'Title length must between 7-50 characters long!', code: 422 });
            resolverErrorChecker({ condition: !validator.isLength(content, { min: 10, max: 350 }), message: 'Description must be between 10-350 characters long!', code: 422 });
            await this.create({ title: title, content: content, imageUrl: imageUrl });
        },
        getAllDocs: async function () {
            const queryRes = await this.find();
            const docs = queryRes.map(doc => ({ id: doc.id, ...doc._doc }));
            return docs;
        },
        deleteDoc: async function (id: string) {
            switch (id) {
                case 'all':
                    await this.deleteMany({});
                    break;
                default:
                    await this.findByIdAndDelete(id);
            }
        }
    }
});


interface InAppNoticeModel extends Model<IInAppNotice> {
    createDoc(input: IInAppNotice): Promise<void>;
    getAllDocs(): Promise<IInAppNotice[]>;
    deleteDoc(id: string): Promise<void>;
}

interface IInAppNotice {
    title: string;
    content: string;
    imageUrl: string | null;
    _doc?: Omit<this, '_doc'>;
}



const InAppNotice = mongoose.model<IInAppNotice, InAppNoticeModel>('inAppNotice', inAppNoticeSchema);

export default InAppNotice;