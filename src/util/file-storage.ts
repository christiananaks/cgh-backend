import path from 'path';
import { rmdir, unlink } from 'fs/promises';
import fs from 'fs';


import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { GraphQLCustomError, errorChecker, getDirname } from './helper.js';
import { FileStorageArgs } from '../models/type-def.js';


export const s3FileUrl = `https://${process.env.GS_AWS_BUCKET_NAME}.s3.${process.env.GS_AWS_REGION}.amazonaws.com/`;

const s3Client = new S3Client({
    region: process.env.GS_AWS_REGION,
    credentials: {
        accessKeyId: process.env.GS_AWS_ACCESS_KEY!,
        secretAccessKey: process.env.GS_AWS_SECRET_ACCESS_KEY!
    }
});

export async function clearImage(filePath: string) {
    filePath = path.join(getDirname(import.meta.url), '../..', filePath);
    try {
        await unlink(filePath);
        console.log('removed file: %s', filePath.substring(filePath.lastIndexOf('/') + 1));
    } catch (err: any) {
        console.log(err?.message);
    }
};


export async function s3DeleteObject(fileKey: string) {
    try {
        fileKey = decodeURIComponent(fileKey);
        // deletes folder i.e all contents in folder with the given object keys
        if (fileKey.endsWith('/')) {
            const listParams = {
                Bucket: process.env.GS_AWS_BUCKET_NAME,
                Prefix: fileKey // e.g product/ID/
            };

            const listCommand = new ListObjectsV2Command(listParams);
            const data = await s3Client.send(listCommand);

            if (!data.Contents || data.Contents.length === 0) {
                throw new GraphQLCustomError('Error: Folder is empty or does not exists!', 404);
            }

            const deleteParams = {
                Bucket: process.env.GS_AWS_BUCKET_NAME,
                Delete: { Objects: data.Contents.map(obj => ({ Key: obj.Key })) }
            };

            const deleteCommand = new DeleteObjectsCommand(deleteParams);
            await s3Client.send(deleteCommand);
            return;
        }

        const params = { Key: fileKey, Bucket: process.env.GS_AWS_BUCKET_NAME };
        const command = new DeleteObjectCommand(params);
        await s3Client.send(command);
    } catch (err: any) {
        console.log(err.message);
        throw new GraphQLCustomError(`Operation failed! Error occurred deleting objects.\n${err.mesage}`);
    }
}

export async function s3UploadObject(args: FileStorageArgs) {
    const { uploadedFiles, id, folderName, filesURLPath } = args;

    try {
        for (var i = 0; i < uploadedFiles.length; i++) {
            const { filename, mimetype, encoding, createReadStream } = uploadedFiles[i];
            const stream = createReadStream();

            const s3Params = {
                Bucket: process.env.GS_AWS_BUCKET_NAME!,
                Key: 'to be generated',
                Body: stream,
                ContentType: mimetype
            };


            const filenameOnly = filename.substring(0, filename.lastIndexOf('.'));
            const fileExt = filename.replaceAll(filenameOnly, '').trim();

            if (i === 0 && ['product', 'KYC'].includes(folderName)) {
                errorChecker({ condition: !id, message: `Error: ${folderName} ID is not provided.` });

                const p = `${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                s3Params.Key = p;
                const uploader = new Upload({ client: s3Client, params: s3Params });
                const data = await uploader.done();
                filesURLPath.push(data.Location!);
                continue;

            } else if (['product', 'KYC'].includes(folderName)) {

                const p = `${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                s3Params.Key = p;
                const uploader = new Upload({ client: s3Client, params: s3Params });
                const data = await uploader.done();
                filesURLPath.push(data.Location!);
                continue;
            }


            const p = `${folderName}/${i}-${new Date().toISOString()}${filename}`;
            s3Params.Key = p;
            const uploader = new Upload({ client: s3Client, params: s3Params });
            const data = await uploader.done();

            filesURLPath.push(data.Location!);

        }
    } catch (err: any) {
        if (err instanceof GraphQLCustomError) {
            throw err;
        }
        throw new GraphQLCustomError(`Error uploading file!\nInfo=> ${err.message}`);
    }
}

export async function localUpload(args: FileStorageArgs) {
    const { uploadedFiles, id, folderName, pathName, filesURLPath } = args;

    for (var i = 0; i < uploadedFiles.length; i++) {
        const { filename, mimetype, encoding, createReadStream } = uploadedFiles[i];
        const stream = createReadStream();

        console.log(`index: ${i} =>`, filename, mimetype, encoding);
        try {
            await new Promise(async (resolve, reject) => {

                const filenameOnly = filename.substring(0, filename.lastIndexOf('.'));
                const fileExt = filename.replaceAll(filenameOnly, '').trim();

                if (i === 0 && ['product', 'KYC'].includes(folderName)) {
                    try {
                        errorChecker({ condition: !id, message: `Error: ${folderName} ID is not provided.` });
                    } catch (err: any) {
                        reject(err.message);
                        return;
                    }

                    // if id folder exists, it is removed and recreated to ensure we don't keep old files for that product
                    await rmdir(`${pathName}/${folderName}/${id}`).catch((err) => undefined);
                    fs.mkdirSync(`${pathName}/${folderName}/${id}`);

                    const p = `${pathName}/${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                    saveImageLocally(p, stream, filesURLPath, resolve, reject);
                    return;
                } else if (['product', 'KYC'].includes(folderName)) {

                    const p = `${pathName}/${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                    saveImageLocally(p, stream, filesURLPath, resolve, reject);
                    return;
                }

                const p = `${pathName}/${folderName}/${i}-${new Date().toISOString()}${filename}`;
                saveImageLocally(p, stream, filesURLPath, resolve, reject);
            });
        } catch (err: any) {
            // case where `reject` was invoked during stream.pipe execution
            if (!err) {
                throw new GraphQLCustomError('An error occurred while uploading image.');
            }
            throw new GraphQLCustomError(err);
        }
    }
}


type TVoidCallBack = (value: unknown) => void;
function saveImageLocally(path: string, stream: fs.ReadStream, filesURLPath: string[], resolve: TVoidCallBack, reject: TVoidCallBack) {
    stream.pipe(fs.createWriteStream(path)).on('finish', resolve).on('error', reject);
    filesURLPath.push(path.slice(path.indexOf(`uploads`)));
}
