import { mergeResolvers } from "@graphql-tools/merge";

import superUserResolvers from "./admin/resolvers/super-user-resolver";
import appResolvers from "./public/app-resolvers";
import userResolvers from "./user/resolvers/user-resolvers";
import adminUserResolvers from "./admin/resolvers/admin-user-resolvers";


const res = [superUserResolvers, appResolvers, userResolvers, adminUserResolvers];

export default mergeResolvers(res);