import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLSchema } from 'graphql';

import adminSchema from "./admin/schema/admin-schema.js";
import appSchema from "./public/app-schema.js";
import userSchema from "./user/schema/user-schema.js";
import superUserResolvers from "./admin/resolvers/super-user-resolver.js";
import appResolvers from "./public/app-resolvers.js";
import userResolvers from "./user/resolvers/user-resolvers.js";
import adminUserResolvers from "./admin/resolvers/admin-user-resolvers.js";



const execSchema: GraphQLSchema = makeExecutableSchema({
    typeDefs: [adminSchema, appSchema, userSchema], resolvers: [superUserResolvers, appResolvers, userResolvers, adminUserResolvers]
});

export default execSchema;
