import {
  ReturnModelType,
  getModelForClass,
  mongoose,
  prop,
} from '@typegoose/typegoose';

class Email {
  @prop({ type: () => String, required: true })
  firstName!: string;

  @prop({ type: () => String, required: true })
  lastName!: string;

  @prop({ type: () => String, required: true, unique: true })
  email!: string;

  @prop({ type: () => Boolean, required: true, default: true })
  subscribed!: boolean;

  @prop({ type: String, required: false, default: [] })
  recieved!: string[];
}

const EmailModel: ReturnModelType<typeof Email> = getModelForClass(Email);

export default EmailModel;
