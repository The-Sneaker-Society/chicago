import mongoose, {Document, Schema} from "mongoose";

interface IEmail extends Document {
    firstName: string,
    lastName:string,
    email: string,
    subscribed: boolean, 
    recieved: string[]
}

export const EmailSchema = new Schema<IEmail>(
    {
        firstName: {
            type: String,
            required: true,
          },
          lastName: {
            type: String,
            required: true,
          },
          email: {
            type: String,
            required: true,
            unique: true,
          },
          subscribed: {
            type: Boolean,
            required: true,
            default: true,
          } ,
          recieved: {
            type: [String],
            default: []
          }
        }
        , {
         collection: 'emails',
         timestamps: true
       }
)

const EmailModel = mongoose.model<IEmail>('Email', EmailSchema)

export default EmailModel;