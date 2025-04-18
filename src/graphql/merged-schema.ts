import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLSchema } from 'graphql';

import baseSchema from "./base-schema";
import adminSchema from "./admin/schema/admin-schema";
import appSchemaDef from "./public/app-schema";
import userSchemaDef from "./users/schema/user-schema";



//  const testResolvers = { // for writing resolvers for graphtools makeExecutableSchema. Query and Mutation must be one level nested in object
//     Query: {
//         hello: (obj: any, args: any, ctx: any, info: any) => {
//             return 'Hello from GraphQL!' + ' ' + args.num;
//         }
//     },
// };

const mergedSchema: GraphQLSchema = makeExecutableSchema({
    typeDefs: [baseSchema, adminSchema, appSchemaDef, userSchemaDef],

});

export default mergedSchema;
