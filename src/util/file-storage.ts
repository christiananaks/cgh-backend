import path from 'path';
import fs from 'fs';
import { rmdir } from 'fs/promises';


import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { GraphQLCustomError, resolverErrorChecker, getDirname } from './helper.js';
import { FileStorageArgs } from '../models/type-def.js';


export const s3FileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

export function clearImage(filePath: string) {
    filePath = path.join(getDirname(import.meta.url), '../..', filePath);
    fs.unlink(filePath, err => {
        if (err) {
            console.log('error deleting image:', err?.message);
            return;
        }
        console.log('removed file: %s', filePath.substring(filePath.lastIndexOf('/') + 1));
    });
};


export async function s3DeleteObject(fileKey: string) {
    try {
        // deletes folder i.e all contents with the given object keys
        if (fileKey.endsWith('/')) {
            const listParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Prefix: fileKey // e.g product/ID/
            };

            const listCommand = new ListObjectsV2Command(listParams);
            const data = await s3Client.send(listCommand);

            if (!data.Contents || data.Contents.length === 0) {
                throw new GraphQLCustomError('Error: Folder is empty or does not exists!', 404);
            }

            const deleteParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Delete: { Objects: data.Contents.map(obj => ({ Key: obj.Key })) }
            };

            const deleteCommand = new DeleteObjectsCommand(deleteParams);
            await s3Client.send(deleteCommand);
            return;
        }

        const params = { Key: fileKey, Bucket: process.env.AWS_BUCKET_NAME };
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
                Bucket: process.env.AWS_BUCKET_NAME!,
                Key: 'to be generated',
                Body: stream,
                ContentType: mimetype
            };

            console.log(`index: ${i} =>`, filename, mimetype, encoding);

            const filenameOnly = filename.substring(0, filename.lastIndexOf('.'));
            const fileExt = filename.replaceAll(filenameOnly, '').trim();

            if (i === 0 && ['product', 'KYC'].includes(folderName)) {
                resolverErrorChecker({ condition: !id, message: `Error: ${folderName} ID is not provided.` });

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
            console.log(data.Key);

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
                        resolverErrorChecker({ condition: !id, message: `Error: ${folderName} ID is not provided.` });
                    } catch (err: any) {
                        reject(err.message);
                        return;
                    }

                    // if id folder exists, it is removed and recreated to ensure we don't keep old files for that product
                    await rmdir(`${pathName}/${folderName}/${id}`).catch((err) => undefined);
                    fs.mkdirSync(`${pathName}/${folderName}/${id}`);

                    const p = `${pathName}/${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                    stream.pipe(fs.createWriteStream(p)).on('finish', resolve).on('error', reject);
                    filesURLPath.push(p.slice(p.indexOf(`uploads`)));
                    return;
                } else if (['product', 'KYC'].includes(folderName)) {

                    const p = `${pathName}/${folderName}/${id}/${i}-${filenameOnly}${fileExt}`;
                    stream.pipe(fs.createWriteStream(p)).on('finish', resolve).on('error', reject);
                    filesURLPath.push(p.slice(p.indexOf(`uploads`)));
                    return;
                }

                const p = `${pathName}/${folderName}/${i}-${new Date().toISOString()}${filename}`;
                stream.pipe(fs.createWriteStream(p)).on('finish', resolve).on('error', reject);
                filesURLPath.push(p.slice(p.indexOf(`uploads`)));
            });
        } catch (err: any) {
            throw new GraphQLCustomError(err);
        }
    }
}
