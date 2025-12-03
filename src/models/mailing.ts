import mongoose, { Model, Schema } from "mongoose";
import nodemailer from 'nodemailer';
import { HydratedDocument } from "mongoose";

import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import { IDocProps } from "./type-def.js";
import user from "./user.js";

const mailingSchema = new Schema<IMailing, IMailingModel>({
    info: {
        type: {
            kind: {
                type: String,
                required: true
            },
            subject: {
                type: String,
                required: true
            },
            body: {
                type: String,
                required: true
            }
        },
        required: true
    },
    failedDelivery: {
        type: [],
        required: true
    },
    createdAt: {
        type: Date,
        expires: '7d'
    }
}, { timestamps: true });


export interface IMailing extends IDocProps {
    info: {
        kind: string;
        subject: string;
        body: string;
    },
    failedDelivery: any[];
}


mailingSchema.statics.sendEmail = async function (email: string, subject: string, htmlBody: string): Promise<SMTPTransport.SentMessageInfo> {
    const transport = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
            user: 'apikey',
            pass: `${process.env.SENDGRID_KEY}`
        }
    });

    return await transport.sendMail({
        from: `${process.env.COMPANY_EMAIL}`,
        to: email,
        subject: subject,
        html: htmlBody,
    });
};


type TEmailProps = { kind: string; subject: string; content: string; };
interface IMailingModel extends Model<IMailing, {}> {
    sendBulkEmail: ({ emailProps, mailDoc }: { emailProps: TEmailProps; mailDoc?: HydratedDocument<IMailing>; }) => Promise<boolean>;
    sendEmail: (email: string, subject: string, htmlBody: string) => Promise<SMTPTransport.SentMessageInfo>;
}

mailingSchema.statics.sendBulkEmail = async function ({ emailProps, mailDoc }: { emailProps: TEmailProps; mailDoc?: HydratedDocument<IMailing>; }) {
    type TMailData = { email: string; firstName: string; lastName: string; username: string; };
    let allUsers: TMailData[] | string[];
    const { kind, subject, content } = emailProps;

    // where request is for `/retry-mail/:mailId` use `failedDelivery` 
    if (mailDoc) {
        allUsers = mailDoc.failedDelivery;
    } else {
        const query = await user.find().select('email firstName lastName username');
        allUsers = query.map((doc: any) => {
            return { email: doc.email, firstName: doc.firstName, lastName: doc.lastName, username: doc.username };
        });
    }

    let failedDelivery: any[] = [];
    if (kind.toLowerCase() === 'personalized') {
        // send mail to each user containing user specific data such as name/username
        for (const user of allUsers as TMailData[]) {
            const processedContent = content.replaceAll('%firstName%', user.firstName).replaceAll('%lastName%', user.lastName);
            const mailing = await Mailing.sendEmail(user.email, subject, processedContent);
            if (!mailing.accepted.includes(user.email)) {
                failedDelivery.push({ email: user.email, firstName: user.firstName, lastName: user.lastName, username: user.username });
            }
        }

    } else {
        // send general email to all users // where request is for `/retry-mail/:mailId` use `failedDelivery` 
        allUsers = mailDoc ? mailDoc.failedDelivery : (allUsers as TMailData[]).map(user => user.email) as any;
        const mailing = await Mailing.sendEmail(allUsers.join(', '), subject, content);
        if (mailing.rejected.length > 0) {
            failedDelivery = [...mailing.rejected] as string[];
        }
    }

    // for retries, update `failedDelivery` array on db else create mail document when there are unsuccessful deliveries
    if (mailDoc && failedDelivery.length > 0) {
        mailDoc.failedDelivery = failedDelivery;
        mailDoc.save().catch(err => console.log(err.toString()));   // we dont want to wait for the save to complete so we catch errors asynchronously
        return false;
    } else if (mailDoc && failedDelivery.length < 1) {
        mailDoc.deleteOne();
        mailDoc.save();
    }

    if (!mailDoc && failedDelivery.length > 0) {
        const mailingRecord = new Mailing({ info: { kind: kind, subject: subject, body: content }, failedDelivery: failedDelivery });
        mailingRecord.save().catch(err => console.log(err.toString()));
        return false;
    }

    return true;
}

const Mailing = mongoose.model<IMailing, IMailingModel>('Mailing', mailingSchema);

export default Mailing;


