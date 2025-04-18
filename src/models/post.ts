import mongoose, { Document, Model, Schema, Types } from "mongoose";
import User from "./user";
import { resolverErrorChecker } from "../util/helper";

const postSchema = new Schema<IPost, IPostModel, IPostMethods>({
    postTitle: {
        type: String,
        required: true
    },
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
            }
        }
    ]
}, {
    timestamps: true, statics: {
        getPost: async function () {
            let posts = await this.find().populate('comments.userInfo', 'profilePic username');  // populate only picture and username

            resolverErrorChecker({ condition: !posts, code: 404, message: 'No post found :(' });   // throw error cos we always want to return a post
            // const totalPost = post.length;
            // const genIndex = Math.floor(Math.random() * totalPost);
            const post = posts.map((post: IPost) => {
                const commentData = post.comments.map((obj: any) => {

                    return {
                        commentId: obj._id.toString(),
                        profilePic: obj.userInfo.profilePic,
                        username: obj.userInfo.username,
                        comment: obj.comment,
                    };
                });

                return { postId: post.id, postTitle: post.postTitle, comments: commentData };
            });
            return post[0];
        },
        deleteFeedPost: async function (postId: string) {
            await this.findByIdAndDelete(postId);
        }
    }
},);

postSchema.method('pushComment', async function (commentData: object) {
    this.comments.push(commentData);
    await this.save();
});

postSchema.method('editComment', async function (commentId: string, commentText: string) {
    const index = this.comments.findIndex((comm: Comment) => comm._id!.toString() === commentId);
    resolverErrorChecker({ condition: index < 0, code: 404, message: 'Comment not found :(' });

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
    deleteFeedPost(postId: string): Promise<void>;
    getPost(): Promise<IPost>;
}

interface IPostMethods {
    pushComment(commentData: Comment): Promise<void>;
    editComment(commentId: string, commentText: string): Promise<Comment>;
}

export type Comment = {
    _id?: string;
    userInfo: Types.ObjectId;
    comment: string;
}
interface IPostProps {
    _doc: Omit<this, '_doc'>
}
export interface IPost extends Document, IPostProps, IPostMethods {
    postTitle: string;
    comments: Types.Array<Comment>;
}
/****************************************************************************/


const Post = mongoose.model<IPost, IPostModel>('Post', postSchema);
export default Post;