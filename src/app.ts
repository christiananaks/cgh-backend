// @ts-ignore
import graphiql from 'express-graphiql-explorer';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { createHandler } from 'graphql-http/lib/use/express';
import bodyParser from 'body-parser';

import userstats from './middleware/userstats';
import mergedSchema from './graphql/merged-schema';
import auth from './middleware/auth';
import mergedResolvers from './graphql/merged-resolvers';
import refreshToken from './routes/refresh-token';
import getToken from './routes/get-token';
import servMgt from './routes/serv-mgt';
import serverStatus from './middleware/server-mgt-status';
import fileUpload from './routes/file-upload';
import verifyPayment from './routes/verify-payment';
import verifyOfflinePayment from './routes/verify-offline-payment';
import getNewPassword from './routes/get-new-password';
import getFile from './routes/get-file';
import createPodOrder, { createReqOrder } from './routes/create-order';
import { fileFilter, docFileFilter, fileStorage } from './util/file-storage';
import { paths } from './util/path-linker';

/************     CHANGES:     ************/
const app = express();

// 5 image slots for various form fields for product bulk image upload
const imageFields = [
    { name: 'slot0', maxCount: 1 },
    { name: 'slot1', maxCount: 1 },
    { name: 'slot2', maxCount: 1 },
    { name: 'slot3', maxCount: 1 },
    { name: 'slot4', maxCount: 1 }
];

const kycDocFields = [
    { name: 'validId', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 },
];

app.use(bodyParser.json());
// handles timeout
app.use((req, res, next) => {

    req.prependListener('resume', () => {
        console.log('server request resume');
        // if (!res.closed) {
        //     res.status(408).send('Request timeout.');

        //     return req.destroy();
        // }
    });

    next();
});

// GameSwap | GameRent => '/game-image' // GameDownloads | GameRepair => '/product-image'
app.use('/image-upload', multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'), fileUpload);  // executed on every multipart/form-data enctype incoming req

app.use('/upload-screenshot', multer({ dest: paths.miscDir, fileFilter: fileFilter }).single('misc'), (req, res, next) => {
    if (!req.file) {
        return next(new Error('Error: File upload error!'));
    }
    res.status(200).json({ message: 'File uploaded successfully.', filePath: req.file.path });
});

// bulk image uploads
app.use('/image-uploads', (req, res, next) => {
    const validEndpoints = ['/product-images', '/image-guides'];
    if (!validEndpoints.includes(req.url)) {
        const error = new Error(`Invalid route parameter! route endpoint params are:- ${validEndpoints.join(', ')}`);
        return next(error);
    }
    next();
}, multer({ storage: fileStorage, fileFilter: fileFilter }).fields(imageFields), fileUpload);


app.use('/document-uploads', multer({ storage: fileStorage, fileFilter: docFileFilter }).fields(kycDocFields), fileUpload);

// '/uploads-misc/post-refund-uploads' , and propective misc uploads endpoints  // accepts both image and doc file types
app.use('/misc-uploads', multer({ storage: fileStorage, fileFilter: docFileFilter }).array('misc', 3), fileUpload); // endpoint for multiple miscellaneous files uploads such as transfer screenshots, images for help requests, etc.

//merge to one route[append the end path after uploads to their respective GET router.METHOD inside getFile] - TEST -- get document, images, misc
app.use('/uploads', getFile);
// app.use('/uploads/documents', getFile);
// app.use('/uploads/images', getFile);
// app.use('/uploads/misc', getFile);

app.use((req, res, next) => {
    // add header to configure CORS to enable us share data from the server with client from other domain. // res.setHeader does NOT send a response like json or render, it only modifies the headers
    res.setHeader('Access-Control-Allow-Origin', '*');  // TODO: `*` should be the client domain after development
    res.setHeader('Access-Control-Allow-Methods', "GET, POST, PUT, PATCH, DELETE");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // there are default headers set. we just add specific headers
    next();
});

app.use(getToken);
app.use(getNewPassword);
app.use(refreshToken);
app.use(auth); // run on every req that reaches the graphql endpoint
app.use(verifyOfflinePayment);
app.use('/verify-payment', verifyPayment, createReqOrder, (req, res, next) => {
    console.log('executed after response was sent');
    next();
});
app.use(createPodOrder);
app.use(serverStatus);
app.use(servMgt);
app.use(userstats);

app.use('/graphiql', graphiql({
    graphQlEndpoint: '/graphql',
    defaultQuery: `query Query {
login(email: "test@test.com", password: "Number01") {
accessToken
accType
}
}`
}));

app.all('/graphql', (req: any, res, next) => {

    return createHandler({

        schema: mergedSchema,
        rootValue: mergedResolvers,
        context: { req, res },  // implicitly context: {req: {}, res: {} }, stores the req or res obj val using its identifier as key
        formatError(err: any) { // originalError => errors thrown by you or third party packages: mongoose, etc
            // check whether request already timed out. if true destroy socket and log error. 
            // This custom timeout error event should be triggered inside the REST MW error handler
            if (!err.originalError) {
                console.log('unhandled Error caught by graphql: ', err.message);
                return err; // errors returned by graphql and unhandled errors. // query syntax errors from frontend
            }
            const data = err.originalError.data;
            const code = err.originalError.statusCode || 500;
            const message = err.originalError.message || 'An error occurred :(';
            console.log('graphql formatError: ', err.originalError.message);

            return { errorData: data, code: code, message: message }    // `errorData` would not be included in response object if `data` is undefined
        },
    })(req, res, next);
},
);

app.use((error: { message: string, statusCode: number }, req: Request, res: Response, next: NextFunction) => {
    console.log('Caught by App level REST MW error handler: \n', `\r${error.message}`);
    const status = error.statusCode || 500;
    const message = error.message;
    return res.status(status).json({ success: false, message: message });
});


mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ytr0dpc.mongodb.net/gamerDB?retryWrites=true`).then((conn) => {
    console.log('connected!');

    const server = app.listen(8080);
    // server.timeout = 6000; // server socket timeout on incoming request // Set to 6000
    // server.requestTimeout = 5000;

}).catch(err => console.log(err));
