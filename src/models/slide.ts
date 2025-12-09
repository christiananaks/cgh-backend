import path from 'path';
import fs from 'fs';

import { GraphQLCustomError, getDirname, isProductionEnv } from '../util/helper.js';


export interface ISlide {
    id: string;
    title: string;
    desc: string | null;
    imageUrl: string;
    creator: string;
    createdAt: string;
}

export const slidesFilePath = path.join(getDirname(import.meta.url), isProductionEnv ? '../../data' : '../../data/dev', 'slides.json');


export class Slide {
    id: ISlide["id"];
    title: ISlide['title'];
    desc: ISlide['desc'];
    imageUrl: ISlide['imageUrl'];
    creator: ISlide['creator'];
    createdAt: ISlide['createdAt'];
    constructor(title: string, desc: string | null, imageUrl: string, createdBy: string) {
        this.id = new Date().toISOString().split('.')[1];
        this.title = title;
        this.desc = desc;
        this.imageUrl = imageUrl;
        this.creator = createdBy;
        this.createdAt = new Date().toISOString();
    }

    async save() {
        try {
            const slidesArray = await Slide.fetchSlides();
            slidesArray.push(this);
            return new Promise((resolve, reject) => {
                fs.writeFile(slidesFilePath, JSON.stringify(slidesArray), err => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(true);
                });
            });
        } catch (err: any) {
            console.log(err.message);
            throw new GraphQLCustomError(`Error encountered saving to file.\n${err.message}`);
        }
    }

    static async fetchSlides() {
        const slidesArray = await new Promise<Slide[]>((resolve, reject) => {
            fs.readFile(slidesFilePath, (err, fileData: Buffer) => {
                if (!err) {
                    resolve(JSON.parse(fileData.toString()));
                }
                else if (err.message.includes('no such file or directory')) {
                    resolve([]);
                }
                else {
                    reject(err);
                }
            });
        });
        return slidesArray;
    }

    static clearSlidesFile(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            fs.writeFile(slidesFilePath, JSON.stringify([]), err => {
                if (err) {
                    console.log(err.message);
                    return reject(new GraphQLCustomError(`Operation failed!\n${err.message}`));
                }
                resolve(true);
            });
        });
    }
}
