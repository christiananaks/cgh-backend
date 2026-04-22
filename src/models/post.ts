import mongoose, { Document, Model, Schema, Types } from "mongoose";
import User from "./user.js";
import { errorChecker, isProductionEnv } from "../util/helper.js";
import { clearImage, s3DeleteObject } from "../util/file-storage.js";

const postSchema = new Schema<IPost, IPostModel, IPostMethods>({
    text: {
        type: String,
        required: true
    },
    imageUrl: String,
    comments: [
        {
            userInfo: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            comment: {
                type: String,
                required: true
            },
            date: {
                type: Date,
                required: true
            }
        }
    ]
}, {
    timestamps: true,
    statics: {
        getPost: async function () {

            let posts = await this.find().populate('comments.userInfo', 'profilePic username');  // populate only picture and username

            errorChecker({ condition: !posts, code: 404, message: 'No post found :(' });
            if (1 > posts.length) return null;
            const newPost = posts[0];
            newPost._doc.comments.forEach((comment) => {
                errorChecker({ condition: !comment.userInfo, message: 'Broken reference error: User not found!' });
            });

            const commentData = newPost.comments.map((commObj: any) => {

                return {
                    commentId: commObj._id.toString(),
                    profilePic: commObj.userInfo.profilePic,
                    username: commObj.userInfo.username,
                    comment: commObj.comment,
                    date: commObj.date.toISOString()
                };
            });
            return { id: newPost.id, ...newPost._doc, comments: commentData };
        },
        deletePost: async function (postId: string) {

            const res = await this.findByIdAndDelete(postId);
            // if (res?.imageUrl && isProductionEnv) {
            //     const fileKey = res!.imageUrl.split('.com/')[1];
            //     await s3DeleteObject(fileKey);
            // } else if (res?.imageUrl && !isProductionEnv) {
            //     await clearImage(res!.imageUrl);
            // }

            errorChecker({ condition: !res, message: 'Post failed to delete!', code: 500 });
        }
    }
},);

postSchema.method('pushComment', async function (commentData: TComment) {
    this.comments.push(commentData);
    const createdComment = await this.save();

    return createdComment.comments[createdComment.comments.length - 1];
});

postSchema.method('editComment', async function (commentId: string, commentText: string) {
    const index = this.comments.findIndex((comm: TComment) => comm._id!.toString() === commentId);
    errorChecker({ condition: index < 0, code: 404, message: 'Comment not found :(' });

    this.comments[index].comment = commentText;
    await this.save();
    const editedComm: any = this.comments[index];

    return {
        commentId: editedComm._id.toString(),
        profilePic: editedComm.userInfo.profilePic,
        username: editedComm.userInfo.username,
        comment: editedComm.comment
    };
});




/***************    Model Types and Interface Definition   *******************/
interface IPostModel extends Model<IPost, {}, IPostMethods> {
    deletePost(postId: string): Promise<void>;
    getPost(): Promise<IPost>;
}

interface IPostMethods {
    pushComment(commentData: TComment): Promise<TComment>;
    editComment(commentId: string, commentText: string): Promise<Comment>;
}

export type TComment = {
    _id?: Types.ObjectId;  // used `_id` as field name for ease of mongoose operation on Post nested object
    userInfo: Types.ObjectId;
    comment: string;
    date: Date;
}
interface IPostProps {
    _doc: Omit<this, '_doc'>
}
export interface IPost extends Document, IPostProps, IPostMethods {
    text: string;
    imageUrl: string | null;
    comments: Types.Array<TComment>;
}
/****************************************************************************/


const Post = mongoose.model<IPost, IPostModel>('Post', postSchema);
export default Post;