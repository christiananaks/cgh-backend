
import { HydratedDocument } from "mongoose";
import User, { UserData } from "../models/user.js";




export default async (req: any, res: any, next: any) => {
    try {
        if (!req.isAuth) {
            return next();
        }

        let user = req.user as HydratedDocument<UserData>;
        const userstatsData = User.updateUserStats(user.stats);

        user.stats = userstatsData.stats;

        if (userstatsData.updatedStats) {
            await user.save();
        }

        next();
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }

}