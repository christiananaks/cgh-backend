import { mergeResolvers } from "@graphql-tools/merge";

import superAdminResolvers from "./admin/resolvers/super-admin-resolver";
import appResolvers from "./public/app-resolvers";
import userResolvers from "./users/resolvers/users-resolvers";
import adminUserResolvers from "./admin/resolvers/admin-user-resolvers";


const res: any = [superAdminResolvers, appResolvers, userResolvers, adminUserResolvers];

export default mergeResolvers(res);