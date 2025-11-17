import path from 'path';
import fs from 'fs';

import { getDirname } from '../util/helper.js';


export interface Slide {
    id: string;
    title: string;
    desc: string | null;
    imageUrl: string;
    creator: string;
    createdAt: string;
}

const fileUrlPath = path.join(getDirname(import.meta.url), '../../data', 'slides.json');


export const getSlidesFromFile = () => {
    return new Promise<NewSlide[]>((resolve, reject) => {
        fs.readFile(fileUrlPath, (err, fileData: Buffer) => {
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
}


export class NewSlide {
    id: Slide["id"];
    title: Slide['title'];
    desc: Slide['desc'];
    imageUrl: Slide['imageUrl'];
    creator: Slide['creator'];
    createdAt: Slide['createdAt'];
    constructor(title: string, desc: string | null, imageUrl: string, createdBy: string) {
        this.id = new Date().toISOString().split('.')[1];
        this.title = title;
        this.desc = desc;
        this.imageUrl = imageUrl;
        this.creator = createdBy;
        this.createdAt = new Date().toISOString();
    }

    save() {
        return getSlidesFromFile().then((slidesArray: NewSlide[]) => {
            slidesArray.push(this);
            return new Promise((resolve, reject) => {
                fs.writeFile(fileUrlPath, JSON.stringify(slidesArray), err => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve('success');
                })
            });
        }).then(res => {
            console.log('Write to file: ', res);
        }).catch(err => {
            console.log('Write error:  ', err.message);
            throw err;
        });

    }

    static async fetchSlides() {
        const slidesArray = await getSlidesFromFile();
        return slidesArray;
    }
}
