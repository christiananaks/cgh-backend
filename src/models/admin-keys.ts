import fs from 'fs';
import path from 'path';

import { getDirname } from '../util/helper.js';



export const accessKeysFile = path.join(getDirname(import.meta.url), '../../data', 'admin-creator-key.json');
export interface AccessData {
    user: string | null,
    access: string
}

export default class AdminKey {
    constructor(accessData: AccessData) {
        this.accessData = accessData;
    }

    accessData: AccessData;
    // add `users` array. it would register any user userId using the keyword. OR add object which key is the userId and val is username

    async save(): Promise<void> {
        // console.log('started writing save....');
        // AdminKey.getAdminKeys().then((keysArray: string[]) => {
        //     keysArray.push(this.keyword);
        //     fs.writeFile(accessKeysFile, JSON.stringify(keysArray), (err) => {
        //         if (err) {
        //             console.log('error writing to admin passfile', err);
        //         }
        //         console.log('finished executing writefile');
        //     })
        // }).catch((err: any) => {
        //     throw err;
        // })

        try {
            const accessKeys = await AdminKey.getAdminKeys();
            accessKeys.push(this.accessData);
            fs.writeFile(accessKeysFile, JSON.stringify(accessKeys), err => {
                if (err) console.log(err);
            });
        } catch (err: any) {
            const error = new Error(`Error on saving phrase: ${err!.message.toString()}`);
            throw error;
        }
    }

    static getAdminKeys(): Promise<AccessData[]> {

        return new Promise<AccessData[]>((resolve, reject) => {
            // read file to get the array then return array of string or empty array
            fs.readFile(accessKeysFile, (err, fileContent) => {
                if (!err) {
                    resolve(JSON.parse(fileContent.toString()));

                } else if (err.message.includes('no such file or directory')) {
                    resolve([]);
                }
                else {
                    reject(err);
                }
            });
        });
    }

    static genKey(keysArray: string[]): string {
        const data = { letters: '1234567890', symbols: '~!@#$%^&*()_+=-?' };
        let word = '';

        do {
            if (word.length < 2) {
                const index = Math.floor(Math.random() * data.letters.length);
                word = word + data.letters[index];
            } else {
                const index = Math.floor(Math.random() * data.symbols.length);
                word = word + data.symbols[index];
            }
        } while (word.length !== 5);

        if (keysArray.includes(word)) {
            console.log('found key in stored keys array: %s', word);
            return this.genKey(keysArray);
        }

        return word;
    }
}