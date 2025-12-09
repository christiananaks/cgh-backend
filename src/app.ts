import http from 'http';

import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import sls from 'serverless-http';


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

await apolloServer.start();

app.use(express.json());

app.use('/uploads', getFile);


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', "GET, POST, PUT, PATCH, DELETE");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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


try {
    await mongoose.connect(`mongodb+srv://${process.env.CONNECTION_STRING}?retryWrites=true`);
    console.log('Database connection established successfully.');
} catch (err: any) {
    console.log("DB CONNECTION FAILED!");
    throw err;
}
User.findOne({ 'accInfo.role': 'superuser' }).then(user => {
    if (!user && process.env.SU_PASSWORD) {
        createSuperUser(process.env.SU_PASSWORD).then(res => console.log('superuser was created successfully')).catch(err => console.log(err.toString()));
    }
}).catch(err => console.log(err.message));

export const handler = sls(app);


