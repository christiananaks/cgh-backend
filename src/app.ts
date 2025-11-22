import http from 'http';

// @ts-ignore
import graphiql from 'express-graphiql-explorer';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { graphqlUploadExpress } from 'graphql-upload-ts';


import userstats from './middleware/userstats.js';
import execSchema from './graphql/merged-schema.js';
import auth from './middleware/auth.js';
import servMgt from './routes/serv-mgt.js';
import postMail from './routes/mailer.js';
import serverStatus from './middleware/server-mgt-status.js';
import verifyPayment from './routes/verify-payment.js';
import verifyOfflinePayment from './routes/verify-offline-payment.js';
import getNewPassword from './routes/get-new-password.js';
import getFile from './routes/get-file.js';
import createPodOrder, { createReqOrder } from './routes/create-order.js';
import User from './models/user.js';
import { createSuperUser } from './util/helper.js';
import { CtxArgs } from './models/type-def.js';


const app = express();
const httpServer = http.createServer(app);
const apolloServer = new ApolloServer({
    schema: execSchema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    csrfPrevention: false,
    formatError: (formattedError, err) => {

        console.log(formattedError);

        return {
            message: formattedError.message,
            code: formattedError.extensions?.code,
            httpStatus: formattedError.extensions?.httpStatus || 500,
            path: formattedError.path
        }
    }
});


app.use(express.json());

await apolloServer.start();

app.use('/uploads', getFile);


app.use((req, res, next) => {
    // add header to configure CORS to enable us share data from the server with client from other domain. // res.setHeader does NOT send a response like json or render, it only modifies the headers
    res.setHeader('Access-Control-Allow-Origin', '*');  // TODO: `*` should be the client domain after development
    res.setHeader('Access-Control-Allow-Methods', "GET, POST, PUT, PATCH, DELETE");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // there are default headers set. we just add specific headers
    next();
});


app.use(getNewPassword);
app.use(auth);
app.use('/mailer', postMail);
app.use(serverStatus);
app.use(servMgt);
app.use(userstats);
app.use(verifyOfflinePayment);
app.use('/verify-payment', verifyPayment, createReqOrder);
app.use(createPodOrder);

// for graphiql explorer
app.use('/graphiql', graphiql({
    graphQlEndpoint: '/graphql',
    defaultQuery: `query Query {
login(email: "test@test.com", password: "${process.env.DEV_PASSWORD}") {
accessToken
role
}
}`
}));

app.all(
    '/cgh-backend-gql',
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
    expressMiddleware(apolloServer, { context: async ({ req, res }) => ({ req: req as CtxArgs['req'], res }) }),
);


app.use((error: { message: string, statusCode: number }, req: Request, res: Response, next: NextFunction) => {
    console.log('Caught by App level REST MW error handler: \n', `\r${error.message}`);
    const status = error.statusCode || 500;
    const message = error.message;

    return res.status(status).json({ success: false, message: message });
});


mongoose.connect(`mongodb+srv://${process.env.CONNECTION_STRING}?retryWrites=true`).then((conn) => {
    console.log('connected!');
    const server = app.listen(process.env.PORT || 8080);

    User.findOne({ 'accInfo.role': 'superuser' }).then(user => {
        if (!user && process.env.SU_PASSWORD) {
            createSuperUser(process.env.SU_PASSWORD).catch(err => console.log(err.toString()));
            console.log('superuser was created successfully');
            return;
        }
    });

}).catch(err => console.log(err));

