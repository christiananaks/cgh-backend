
import User, { UserData } from "../models/user";



export default async (req: any, res: any, next: any) => {
    try {
        if (!req.isAuth) {
            return next();
        }

        const user = req.user as UserData;

        const presentDay = new Date();
        const lastLoginDate = user.userstats.date;
        const oneDay = 86400000;    // in milliseconds


        if (lastLoginDate.toDateString() !== presentDay.toDateString() && presentDay.valueOf() - lastLoginDate.valueOf() <= oneDay) {
            const userstats = {
                streakPoints: ++user.userstats.streakPoints,
                xp: user.userstats.xp,
                date: new Date()
            }

            user.userstats = userstats;
            user.save();
        } else if (lastLoginDate.toDateString() !== presentDay.toDateString()) {
            user.userstats.date = presentDay;
            await user.save();
        }


        next();
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }

}